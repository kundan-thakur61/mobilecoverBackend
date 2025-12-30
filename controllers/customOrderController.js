const CustomOrder = require('../models/CustomOrder');
const Product = require('../models/Product');
const { createOrder, verifyPaymentSignature } = require('../utils/razorpay');
const logger = require('../utils/logger');

/**
 * Create custom order
 * POST /api/custom/order
 */
const createCustomOrder = async (req, res, next) => {
  try {
    const {
      productId,
      variant,
      quantity = 1,
      imageUrls,
      mockupUrl,
      mockupPublicId,
      instructions,
      designData,
      shippingAddress
    } = req.body;

    const userId = req.user.id;

    // Validate product only if provided (custom orders may be free-form)
    let product = null;
    if (productId) {
      product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    }

    // Calculate price (base price only; any promos already reflected in variant.price)
    // Priority: variant.price -> product default variant price -> explicit price in body
    let basePrice = 0;
    if (variant && typeof variant.price === 'number') {
      basePrice = variant.price;
    } else if (product && product.variants && product.variants[0] && typeof product.variants[0].price === 'number') {
      basePrice = product.variants[0].price;
    } else if (req.body.price && typeof req.body.price === 'number') {
      basePrice = req.body.price;
    } else {
      // No source of base price — reject the request
      return res.status(400).json({
        success: false,
        message: 'Unable to determine base price: provide productId, variant.price, or price in payload'
      });
    }
    const totalPrice = basePrice * quantity;

    // normalize imageUrls — accept array of strings or objects
    const normalizedImageUrls = (Array.isArray(imageUrls) ? imageUrls : []).map((img) => {
      if (!img) return null;
      if (typeof img === 'string') return { original: { url: img } };
      return img;
    }).filter(Boolean);

    // Normalize shipping address: controller expects street/zipCode in schema
    const sa = shippingAddress || {};
    const normalizedShipping = {
      name: sa.name,
      phone: sa.phone,
      street: sa.street || sa.address1 || '',
      city: sa.city || '',
      state: sa.state || '',
      zipCode: sa.zipCode || sa.postalCode || '',
      country: sa.country || 'India'
    };

    // Create custom order
    const customOrder = new CustomOrder({
      userId,
      // only set productId when provided
      ...(productId ? { productId } : {}),
      variant,
      quantity,
      imageUrls: normalizedImageUrls,
      mockupUrl,
      mockupPublicId,
      instructions,
      price: totalPrice,
      shippingAddress: normalizedShipping,
      designData: designData || null
    });

    await customOrder.save();

    logger.info('Custom order created:', { 
      customOrderId: customOrder._id, 
      userId, 
      productId 
    });

    res.status(201).json({
      success: true,
      message: 'Custom order created successfully',
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create payment for custom order
 * POST /api/custom/pay
 */
const createCustomPayment = async (req, res, next) => {
  try {
    const { customOrderId } = req.body;

    const customOrder = await CustomOrder.findById(customOrderId);
    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    if (customOrder.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (customOrder.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }

    // Create Razorpay order
    const razorpayOrder = await createOrder({
      amount: Math.round(customOrder.price * 100),
      currency: 'INR',
      receipt: customOrder._id.toString(),
      notes: {
        userId: customOrder.userId.toString(),
        customOrderId: customOrder._id.toString(),
        type: 'custom'
      }
    });

    // Update custom order with payment details
    customOrder.payment.razorpayOrderId = razorpayOrder.id;
    customOrder.payment.amount = customOrder.price;
    await customOrder.save();

    res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        customOrderId: customOrder._id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify custom order payment
 * POST /api/custom/pay/verify
 */
const verifyCustomPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customOrderId
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

    // Find and update custom order
    const customOrder = await CustomOrder.findOne({
      _id: customOrderId,
      'payment.razorpayOrderId': razorpay_order_id
    });

    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    // Update payment details
    customOrder.payment.razorpayPaymentId = razorpay_payment_id;
    customOrder.payment.razorpaySignature = razorpay_signature;
    customOrder.payment.status = 'paid';
    customOrder.payment.paidAt = new Date();
    if (customOrder.status === 'pending') {
      customOrder.status = 'approved';
    }

    await customOrder.save();

    logger.info('Custom payment verified:', { 
      customOrderId: customOrder._id, 
      paymentId: razorpay_payment_id 
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's custom orders
 * GET /api/custom/orders
 */
const getMyCustomOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.id;

    const query = { userId };
    if (status) query.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await CustomOrder.countDocuments(query);
    const customOrders = await CustomOrder.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .populate('productId', 'title brand model');

    res.json({
      success: true,
      data: {
        customOrders,
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
 * Get single custom order
 * GET /api/custom/orders/:id
 */
const getCustomOrder = async (req, res, next) => {
  try {
    const customOrder = await CustomOrder.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('productId', 'title brand model mockupTemplateUrl');

    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    res.json({
      success: true,
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get custom order for public access (Order Success page)
 * GET /api/custom/order/:id
 */
const getCustomOrderPublic = async (req, res, next) => {
  try {
    const customOrder = await CustomOrder.findById(req.params.id)
      .populate('productId', 'title brand model mockupTemplateUrl');

    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    res.json({
      success: true,
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all custom orders (Admin only)
 * GET /api/admin/custom-orders
 */
const getAllCustomOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await CustomOrder.countDocuments(query);
    const customOrders = await CustomOrder.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'name email')
      .populate('productId', 'title brand model');

    res.json({
      success: true,
      data: {
        customOrders,
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
 * Approve custom order (Admin only)
 * PUT /api/admin/custom/:id/approve
 */
const approveCustomOrder = async (req, res, next) => {
  try {
    const { adminNotes, mockupUrl, mockupPublicId } = req.body;

    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    // Update status and admin notes
    customOrder.status = 'approved';
    if (adminNotes) customOrder.adminNotes = adminNotes;
    
    // Update mockup if provided
    if (mockupUrl && mockupPublicId) {
      // Delete old mockup if exists
      if (customOrder.mockupPublicId) {
        const { deleteImage } = require('../utils/cloudinary');
        await deleteImage(customOrder.mockupPublicId);
      }
      
      customOrder.mockupUrl = mockupUrl;
      customOrder.mockupPublicId = mockupPublicId;
    }

    await customOrder.save();

    logger.info('Custom order approved:', { 
      customOrderId: customOrder._id, 
      adminId: req.user.id 
    });

    res.json({
      success: true,
      message: 'Custom order approved successfully',
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject custom order (Admin only)
 * PUT /api/admin/custom/:id/reject
 */
const rejectCustomOrder = async (req, res, next) => {
  try {
    const { reason, adminNotes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    customOrder.status = 'rejected';
    customOrder.rejectionReason = reason;
    if (adminNotes) customOrder.adminNotes = adminNotes;

    await customOrder.save();

    // If payment was made, initiate refund
    if (customOrder.payment.status === 'paid') {
      const { refundPayment } = require('../utils/razorpay');
      try {
        await refundPayment(customOrder.payment.razorpayPaymentId);
        customOrder.refundStatus = 'processing';
        await customOrder.save();
      } catch (refundError) {
        logger.error('Refund failed:', refundError);
      }
    }

    logger.info('Custom order rejected:', { 
      customOrderId: customOrder._id, 
      reason,
      adminId: req.user.id 
    });

    res.json({
      success: true,
      message: 'Custom order rejected successfully',
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update custom order status (Admin only)
 * PUT /api/admin/custom/:id/status
 */
const updateCustomOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, notes } = req.body;

    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    customOrder.status = status;
    if (trackingNumber) customOrder.trackingNumber = trackingNumber;
    if (notes) customOrder.adminNotes = notes;

    await customOrder.save();

    logger.info('Custom order status updated:', { 
      customOrderId: customOrder._id, 
      status,
      adminId: req.user.id 
    });

    res.json({
      success: true,
      message: 'Custom order status updated successfully',
      data: { customOrder }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a custom order (Admin only, pending/rejected only)
 * DELETE /api/admin/custom/:id
 */
const deleteCustomOrder = async (req, res, next) => {
  try {
    const customOrder = await CustomOrder.findById(req.params.id);
    if (!customOrder) {
      return res.status(404).json({
        success: false,
        message: 'Custom order not found'
      });
    }

    const deletableStatuses = ['pending', 'rejected'];
    if (!deletableStatuses.includes(customOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or rejected custom orders can be deleted'
      });
    }

    await customOrder.deleteOne();

    logger.info('Custom order deleted:', {
      customOrderId: customOrder._id,
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Custom order deleted successfully',
      data: { customOrderId: customOrder._id }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomOrder,
  createCustomPayment,
  verifyCustomPayment,
  getMyCustomOrders,
  getCustomOrder,
  getCustomOrderPublic,
  getAllCustomOrders,
  approveCustomOrder,
  rejectCustomOrder,
  updateCustomOrderStatus,
  deleteCustomOrder
};
