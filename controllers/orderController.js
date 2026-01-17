/**
 * Get user's custom orders only
 * GET /api/orders/my-custom
 */
const getMyCustomOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.id;

    // Only orders where at least one item is a custom product
    const query = {
      userId,
      'items.productId': { $regex: /^custom_/ }
    };
    if (status) query.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalOrders: totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ...existing code...
const Order = require('../models/Order');
const Product = require('../models/Product');
const { createOrder: createRazorpayOrder, verifyPaymentSignature } = require('../utils/razorpay');
const logger = require('../utils/logger');
const { paginatedQuery } = require('../utils/queryOptimizer');
const { createAutoShipment } = require('../utils/autoShiprocket');

/**
 * Create a new order
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod = 'razorpay' } = req.body;
    // Support guest checkout - userId is optional
    const userId = req.user?.id || null;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Validate shippingAddress
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    const requiredAddressFields = ['name', 'phone', 'address1', 'city', 'state', 'postalCode'];
    const missingFields = requiredAddressFields.filter(field => !shippingAddress[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required address fields: ${missingFields.join(', ')}`
      });
    }

    // Process items and calculate total
    let total = 0;
    const processedItems = [];

    for (const item of items) {
      // support custom cart items - check both item.productId and item.product._id
      const itemProductId = item.productId || (item.product && (item.product._id || item.product.id));
      
      // Check if this is a custom item (not a MongoDB ObjectId)
      const isCustomProduct = typeof itemProductId === 'string' && !/^[a-fA-F0-9]{24}$/.test(itemProductId);
      
      if (isCustomProduct) {
        // For custom items (custom_*, cc_*, etc.) we don't require a DB product — the client should send necessary fields
        const price = (item.price !== undefined && typeof item.price === 'number') ? item.price : (item.variant?.price || 0);
        const qty = item.quantity || 1;
        total += price * qty;

        // Ensure image is a string URL, handling Cloudinary objects if passed
        let image = item.image || item.product?.design?.imgSrc || item.product?.images?.[0] || item.variant?.images?.[0] || '';
        if (image && typeof image === 'object') {
          image = image.secure_url || image.url || image.path || '';
        }

        processedItems.push({
          productId: itemProductId,
          variantId: item.variantId || (item.variant && item.variant._id) || null,
          title: item.title || item.product?.title || 'Custom product',
          brand: item.brand || item.product?.brand || item.product?.design?.meta?.company || item.designData?.companyName || null,
          model: item.model || item.product?.model || item.product?.design?.meta?.model || item.designData?.modelName || null,
          color: item.variant?.color || item.variant?.name || null,
          price: price,
          quantity: qty,
          image: image,
          designMeta: item.designMeta || item.designData || item.product?.design?.meta || null,
          material: item.material || item.product?.design?.meta?.material || item.variant?.name || item.variant?.color || item.designData?.material || null
        });

        continue;
      }

      const product = await Product.findById(itemProductId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${itemProductId} not found`
        });
      }

      const variant = product.variants.id(item.variantId);
      if (!variant || !variant.isActive || variant.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Variant ${item.variantId} not available or insufficient stock`
        });
      }

      const itemTotal = variant.price * item.quantity;
      total += itemTotal;

      processedItems.push({
        productId: itemProductId,
        variantId: item.variantId,
        title: product.title,
        brand: product.brand,
        model: product.model,
        color: variant.color,
        price: variant.price,
        quantity: item.quantity,
        image: variant.images.find(img => img.isPrimary)?.url || variant.images[0]?.url,
        designMeta: item.designMeta || item.product?.design?.meta || null,
        material: product.type || item.designMeta?.material || item.product?.design?.meta?.material || variant.name || variant.color || null
      });
    }

    // Create order in database
    const order = new Order({
      userId: userId || undefined,  // Allow null for guest orders
      items: processedItems,
      total,
      shippingAddress: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country || 'India'
      },
      payment: {
        method: paymentMethod
      }
    });

    // Create Razorpay order if payment method is razorpay or upi
    if (paymentMethod === 'razorpay' || paymentMethod === 'upi') {
      try {
        const razorpayOrder = await createRazorpayOrder({
          amount: Math.round(total * 100), // Convert to paise
          currency: 'INR',
          receipt: order._id.toString(),
          notes: {
            userId: userId ? userId.toString() : 'guest',
            orderId: order._id.toString()
          }
        });

        if (!razorpayOrder || !razorpayOrder.id) {
          logger.error('Razorpay did not return a valid order object', { razorpayOrder });
          return res.status(502).json({ success: false, message: 'Payment provider did not return a valid order. Please try again.' });
        }

        order.payment.razorpayOrderId = razorpayOrder.id;
        // store method explicitly (upi/razorpay)
        order.payment.method = paymentMethod;
      } catch (err) {
        // Log detailed info for debugging, but return a clean error to client
        logger.error('Error creating Razorpay order for user order', { err: err && err.message, stack: err && err.stack });
        return res.status(502).json({ success: false, message: 'Failed to create payment order. Please try again later.' });
      }
    }

    await order.save();

    // Create Shiprocket order immediately for all orders (both COD and prepaid)
    try {
      const autoShipmentResult = await createAutoShipment(order._id, 'regular');
      logger.info(`Shiprocket order created for regular order ${order._id}:`, autoShipmentResult);

      // Mark COD orders as confirmed automatically
      if (paymentMethod === 'cod') {
        order.status = 'confirmed';
        order.payment.status = 'pending';
      }
    } catch (shipmentErr) {
      logger.error(`Failed to create Shiprocket order for regular order ${order._id}:`, shipmentErr);
      // For prepaid orders, we can still proceed - they'll get created when payment succeeds
      // For COD orders, we should still mark as confirmed since payment is not required
      if (paymentMethod === 'cod') {
        order.status = 'confirmed';
        order.payment.status = 'pending';
      }
    }

    logger.info('Order created:', { orderId: order._id, userId, total });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order,
        ...(paymentMethod === 'razorpay' && {
          razorpayOrderId: order.payment.razorpayOrderId,
          razorpayKeyId: process.env.RAZORPAY_KEY_ID
        })
      }
    });
  } catch (error) {
    logger.error('Error creating order:', { 
      message: error.message, 
      stack: error.stack,
      requestBody: JSON.stringify(req.body).substring(0, 500)
    });
    next(error);
  }
};

/**
 * Verify payment and update order status
 * POST /api/pay/verify
 */
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    // Verify payment signature
    const isSignatureValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Find and update order
    const order = await Order.findOne({
      _id: orderId,
      'payment.razorpayOrderId': razorpay_order_id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order payment details
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.razorpaySignature = razorpay_signature;
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.status = 'confirmed';

    await order.save();

    // Update product stock
    for (const item of order.items) {
      // Skip stock update for custom items (any non-ObjectId productId)
      if (typeof item.productId === 'string' && !/^[a-fA-F0-9]{24}$/.test(item.productId)) continue;

      const product = await Product.findById(item.productId);
      const variant = product.variants.id(item.variantId);
      variant.stock -= item.quantity;
      await product.save();
    }

    logger.info('Payment verified:', { 
      orderId: order._id, 
      paymentId: razorpay_payment_id 
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Razorpay order for payment
 * POST /api/pay/create
 */
const createPaymentOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }

    // Create Razorpay order
    try {
      const razorpayOrder = await createRazorpayOrder({
        amount: Math.round(order.total * 100),
        currency: 'INR',
        receipt: order._id.toString(),
        notes: {
          userId: order.userId ? order.userId.toString() : 'guest',
          orderId: order._id.toString()
        }
      });

      if (!razorpayOrder || !razorpayOrder.id) {
        logger.error('Razorpay did not return a valid order object (createPaymentOrder)', { razorpayOrder });
        return res.status(502).json({ success: false, message: 'Payment provider did not return a valid order. Please try again.' });
      }

      // Update order with new Razorpay order ID
      order.payment.razorpayOrderId = razorpayOrder.id;
      await order.save();

      res.json({
        success: true,
        data: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          keyId: process.env.RAZORPAY_KEY_ID
        }
      });
    } catch (err) {
      logger.error('Error creating Razorpay order for existing order', { err: err && err.message, stack: err && err.stack, orderId: order._id });
      return res.status(502).json({ success: false, message: 'Failed to create payment order. Please try again later.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's orders
 * GET /api/orders/my
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.id;

    const query = { userId };
    if (status) query.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .populate('items.productId', 'title brand model variants.images variants.color variants.price');

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalOrders: totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single order
 * GET /api/orders/:id
 */
const getOrder = async (req, res, next) => {
  try {
    // Build query based on authentication status
    const query = { _id: req.params.id };

    // If user is authenticated, only allow access to their own orders
    if (req.user) {
      query.userId = req.user.id;
    }
    // If not authenticated, only allow access to guest orders (userId is null/undefined)

    const order = await Order.findOne(query)
      .populate('items.productId', 'title brand model type variants.images variants.color variants.price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel order
 * PUT /api/orders/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    logger.info('[CancelOrder] Request received', {
      orderId: req.params.id,
      userId: req.user?.id,
      body: req.body
    });
    const { reason } = req.body;
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!order) {
      logger.warn('[CancelOrder] Order not found', { orderId: req.params.id, userId: req.user?.id });
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      logger.warn('[CancelOrder] Order not cancellable', { orderId: order._id, status: order.status });
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    order.cancellationReason = reason;

    await order.save();

    logger.info('[CancelOrder] Order cancelled', { orderId: order._id, userId: req.user.id, reason });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('[CancelOrder] Error', { error, orderId: req.params.id, userId: req.user?.id });
    next(error);
  }
};

/**
 * Get all orders (Admin only)
 * GET /api/admin/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
        { 'payment.razorpayOrderId': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Use optimized paginated query
    const result = await paginatedQuery(Order, query, {
      page: pageNum,
      limit: limitNum,
      sort: { createdAt: -1 },
      populate: [
        { path: 'userId', select: 'name email' },
        { path: 'items.productId', select: 'title brand model type variants.images variants.color variants.price' }
      ],
      lean: true
    });

    // Ensure all items have images - fallback to product variant images if item.image is missing
    const orders = result.data.map(order => {
      order.items = order.items.map(item => {
        // If item.image is missing or empty, try to get it from populated product data
        if (!item.image && item.productId && typeof item.productId === 'object') {
          const variant = item.productId.variants?.find(v => v._id?.toString() === item.variantId?.toString());
          if (variant?.images && variant.images.length > 0) {
            const primaryImage = variant.images.find(img => img.isPrimary);
            // Handle both string and object image formats
            const imageUrl = primaryImage?.url || primaryImage || variant.images[0]?.url || variant.images[0];
            item.image = typeof imageUrl === 'string' ? imageUrl : (imageUrl?.url || imageUrl?.secure_url || imageUrl?.path || '');
          }
        }
        return item;
      });
      return order;
    });

    res.json({
      success: true,
      data: {
        orders,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (Admin only)
 * PUT /api/admin/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, notes } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const previousStatus = order.status;
    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;

    await order.save();

    logger.info('Order status updated:', { 
      orderId: order._id, 
      status,
      adminId: req.user.id 
    });

    // Create automatic shipment if order is newly confirmed
    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      try {
        await createAutoShipment(order._id);
        logger.info(`Auto shipment created for manually confirmed order ${order._id}`);
      } catch (shipmentErr) {
        logger.error(`Failed to create auto shipment for manually confirmed order ${order._id}:`, shipmentErr);
      }
    }

    // Emit socket.io event for real-time update
    try {
      const { io } = require('../index');
      if (io) {
        io.to(String(order._id)).emit('orderStatusUpdate', {
          orderId: order._id,
          status: order.status,
          trackingNumber: order.trackingNumber || null,
          notes: order.notes || null
        });
      }
    } catch (err) {
      logger.warn('Socket.io emit failed:', err);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};



const trackOrder = async (req, res, next) => {
  try {
    const { type, id } = req.query;

    if (!type || !id) {
      return res.status(400).json({
        success: false,
        message: 'Tracking type and ID are required'
      });
    }

    let order;

    switch (type) {
      case 'orderId':
        order = await Order.findById(id);
        break;
      
      case 'awb':
        order = await Order.findOne({
          $or: [
            { trackingNumber: id },
            { 'deliveryOne.awbCode': id },
            { 'deliveryOne.waybill': id }
          ]
        });
        break;
      
      case 'shipmentId':
        order = await Order.findOne({
          $or: [
            { 'deliveryOne.shipmentId': id },
            { 'shiprocket.shipmentId': parseInt(id) }
          ]
        });
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid tracking type. Use orderId, awb, or shipmentId'
        });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with the provided tracking information'
      });
    }

    res.json({
      success: true,
      order: {
        _id: order._id,
        items: order.items,
        total: order.total,
        status: order.status,
        trackingNumber: order.trackingNumber || order.shiprocket?.awbCode || '',
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        estimatedDelivery: order.estimatedDelivery,
        notes: order.notes,
        deliveryOne: order.deliveryOne,
        shiprocket: order.shiprocket,
        payment: {
          method: order.payment?.method,
          status: order.payment?.status
        }
      }
    });
  } catch (error) {
    logger.error('Track order error:', error);
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  createPaymentOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getMyCustomOrders,
  trackOrder
};