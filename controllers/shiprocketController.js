const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const shiprocketService = require('../utils/shiprocket');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Create shipment in Shiprocket for an order
 * POST /api/admin/shiprocket/create-shipment
 */
const createShipment = async (req, res, next) => {
  try {
    console.log('[Shiprocket] Processing createShipment (v3). Request Body:', JSON.stringify(req.body, null, 2));
    const { orderId, orderType = 'regular', pickupLocation, dimensions, weight } = req.body;

    // Get order details based on type
    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId).populate('userId');
    } else {
      order = await Order.findById(orderId).populate('userId');
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if shipment already exists
    if (order.shiprocket?.shipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Shipment already created for this order',
        data: {
          shipmentId: order.shiprocket.shipmentId,
          awbCode: order.shiprocket.awbCode
        }
      });
    }

    // Prepare order items for Shiprocket
    let orderItems;
    if (orderType === 'custom') {
      const rawSku = order.variant?.sku || `CUSTOM-${orderId}`;
      let sku = String(rawSku).trim();
      
      if (sku.length > 50) {
        console.log(`[Shiprocket] Truncating Custom SKU from ${sku.length} chars to 40 chars`);
        sku = sku.slice(-40);
      }

      orderItems = [{
        name: `Custom ${order.designData?.modelName || 'Mobile Cover'}`,
        sku: sku,
        units: order.quantity || 1,
        selling_price: order.price,
        discount: 0,
        tax: 0,
        hsn: 392690 // HSN code for plastic articles
      }];
    } else {
      orderItems = order.items.map(item => {
        // Prefer item.sku if available, otherwise fallback to IDs
        const rawSku = item.sku || item.variantId?.toString() || item.productId?.toString() || 'SKU-NA';
        
        // Shiprocket limit is 50 chars. Ensure we truncate if longer.
        let sku = String(rawSku).trim();
        
        if (sku.length > 50) {
          console.log(`[Shiprocket] Truncating SKU from ${sku.length} chars to fit limit`);
          sku = sku.slice(-40);
        }

        return {
          name: item.title || 'Mobile Cover',
          sku: sku,
          units: item.quantity,
          selling_price: item.price,
          discount: 0,
          tax: 0,
          hsn: 392690
        };
      });
    }

    // Split customer name
    const fullName = order.shippingAddress?.name || order.userId?.name || 'Customer';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Get email and phone
    const email = order.userId?.email || order.shippingAddress?.email || 'customer@example.com';
    const phone = order.shippingAddress?.phone || '0000000000';

    // Prepare Shiprocket order data
    const shiprocketOrderData = {
      orderId: orderType === 'custom' ? `CUST-${orderId}` : `ORD-${orderId}`,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupLocation: pickupLocation || 'Primary',
      billingCustomerName: firstName,
      billingLastName: lastName,
      billingAddress: order.shippingAddress?.address1 || order.shippingAddress?.street,
      billingAddress2: order.shippingAddress?.address2 || '',
      billingCity: order.shippingAddress?.city,
      billingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      billingState: order.shippingAddress?.state,
      billingCountry: order.shippingAddress?.country || 'India',
      billingEmail: email,
      billingPhone: phone,
      shippingIsBilling: true,
      orderItems: orderItems,
      paymentMethod: order.payment?.status === 'paid' ? 'Prepaid' : 'COD',
      subTotal: orderType === 'custom' ? order.price : order.total,
      length: dimensions?.length || 15,
      breadth: dimensions?.breadth || 10,
      height: dimensions?.height || 2,
      weight: weight || 0.15
    };

    // Log the constructed data to verify SKU truncation before sending
    console.log('[Shiprocket] Sending Order Data to Service:', JSON.stringify(shiprocketOrderData, null, 2));

    // Create order in Shiprocket
    const shiprocketResponse = await shiprocketService.createOrder(shiprocketOrderData);

    // Update order with Shiprocket details
    order.shiprocket = {
      shipmentId: shiprocketResponse.shipment_id,
      orderId: shiprocketResponse.order_id,
      status: shiprocketResponse.status,
      statusCode: shiprocketResponse.status_code,
      lastSyncedAt: new Date()
    };

    await order.save();

    // Verify the save persisted
    const savedOrder = await Order.findById(orderId);
    logger.info('Shiprocket shipment created and saved:', {
      orderId,
      orderType,
      shipmentId: shiprocketResponse.shipment_id,
      savedShipmentId: savedOrder?.shiprocket?.shipmentId,
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Shipment created successfully in Shiprocket',
      data: {
        shipmentId: shiprocketResponse.shipment_id,
        orderId: shiprocketResponse.order_id,
        status: shiprocketResponse.status
      }
    });
  } catch (error) {
    logger.error('Failed to create Shiprocket shipment:', error);
    next(error);
  }
};

/**
 * Assign courier and generate AWB
 * POST /api/admin/shiprocket/assign-courier
 */
const assignCourier = async (req, res, next) => {
  try {
    const { orderId, orderType = 'regular', courierId } = req.body;

    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.shiprocket?.shipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Shipment not created yet. Create shipment first.'
      });
    }

    // If no courier ID provided, get recommended couriers
    let selectedCourierId = courierId;
    if (!selectedCourierId) {
      const couriers = await shiprocketService.getRecommendedCouriers(order.shiprocket.shipmentId);
      if (couriers && couriers.length > 0) {
        // Select the cheapest courier
        const sortedCouriers = couriers.sort((a, b) => a.freight_charge - b.freight_charge);
        selectedCourierId = sortedCouriers[0].courier_company_id;
        logger.info('Auto-selected courier:', {
          courierId: selectedCourierId,
          courierName: sortedCouriers[0].courier_name,
          freight: sortedCouriers[0].freight_charge
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'No courier services available for this shipment'
        });
      }
    }

    // Assign courier and generate AWB
    const awbResponse = await shiprocketService.assignCourier(
      order.shiprocket.shipmentId,
      selectedCourierId
    );

    // Update order with AWB details
    order.shiprocket.awbCode = awbResponse.awb_code;
    order.shiprocket.courierId = selectedCourierId;
    order.shiprocket.courierName = awbResponse.courier_name;
    order.shiprocket.lastSyncedAt = new Date();
    order.trackingNumber = awbResponse.awb_code;

    await order.save();

    logger.info('Courier assigned and AWB generated:', {
      orderId,
      orderType,
      shipmentId: order.shiprocket.shipmentId,
      awbCode: awbResponse.awb_code,
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Courier assigned and AWB generated successfully',
      data: {
        awbCode: awbResponse.awb_code,
        courierName: awbResponse.courier_name,
        shipmentId: order.shiprocket.shipmentId
      }
    });
  } catch (error) {
    logger.error('Failed to assign courier:', error);
    next(error);
  }
};

/**
 * Get recommended couriers for a shipment
 * GET /api/admin/shiprocket/recommended-couriers/:orderId
 */
const getRecommendedCouriers = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { orderType = 'regular' } = req.query;

    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.shiprocket?.shipmentId) {
      logger.warn('getRecommendedCouriers: Shipment not created yet', {
        orderId,
        orderType,
        shiprocket: order.shiprocket
      });
      return res.status(400).json({
        success: false,
        message: 'Shipment not created yet'
      });
    }

    const couriers = await shiprocketService.getRecommendedCouriers(order.shiprocket.shipmentId);

    res.json({
      success: true,
      data: {
        couriers: couriers.map(c => ({
          id: c.courier_company_id,
          name: c.courier_name,
          freight: c.freight_charge,
          estimatedDeliveryDays: c.estimated_delivery_days,
          rating: c.rating,
          etd: c.etd
        })),
        shipmentId: order.shiprocket.shipmentId
      }
    });
  } catch (error) {
    if (error.response) {
      // Propagate Shiprocket API error status and message
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Shiprocket API error'
      });
    }
    logger.error('Failed to get recommended couriers:', error);
    next(error);
  }
};

/**
 * Request pickup for shipment
 * POST /api/admin/shiprocket/request-pickup
 */
const requestPickup = async (req, res, next) => {
  try {
    const { orderId, orderType = 'regular' } = req.body;

    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.shiprocket?.shipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Shipment not created yet'
      });
    }

    if (!order.shiprocket?.awbCode) {
      return res.status(400).json({
        success: false,
        message: 'AWB not generated yet. Assign courier first.'
      });
    }

    const pickupResponse = await shiprocketService.requestPickup(order.shiprocket.shipmentId);

    order.shiprocket.pickupScheduledDate = new Date();
    order.shiprocket.lastSyncedAt = new Date();
    await order.save();

    logger.info('Pickup requested:', {
      orderId,
      orderType,
      shipmentId: order.shiprocket.shipmentId,
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Pickup requested successfully',
      data: pickupResponse
    });
  } catch (error) {
    logger.error('Failed to request pickup:', error);
    next(error);
  }
};

/**
 * Track shipment
 * GET /api/shiprocket/track/:orderId
 */
const trackShipment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { orderType = 'regular' } = req.query;

    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.shiprocket?.awbCode) {
      return res.status(400).json({
        success: false,
        message: 'Tracking not available yet. Shipment not created or AWB not generated.'
      });
    }

    // Track using AWB code
    const trackingData = await shiprocketService.trackShipment(
      order.shiprocket.awbCode,
      'awb'
    );

    // Update order with latest tracking data
    if (trackingData.tracking_data) {
      order.shiprocket.trackingData = {
        currentStatus: trackingData.tracking_data.track_status,
        shipmentStatus: trackingData.tracking_data.shipment_status,
        shipmentTrack: trackingData.tracking_data.shipment_track?.map(t => ({
          status: t.current_status,
          date: new Date(t.date),
          location: t.location,
          activity: t.activity
        })) || [],
        pickupDate: trackingData.tracking_data.pickup_date ? new Date(trackingData.tracking_data.pickup_date) : null,
        deliveryDate: trackingData.tracking_data.delivered_date ? new Date(trackingData.tracking_data.delivered_date) : null,
        expectedDeliveryDate: trackingData.tracking_data.edd ? new Date(trackingData.tracking_data.edd) : null
      };
      order.shiprocket.lastSyncedAt = new Date();
      await order.save();
    }

    res.json({
      success: true,
      data: {
        awbCode: order.shiprocket.awbCode,
        courierName: order.shiprocket.courierName,
        trackingData: order.shiprocket.trackingData,
        currentStatus: trackingData.tracking_data?.track_status,
        shipmentTrack: trackingData.tracking_data?.shipment_track || []
      }
    });
  } catch (error) {
    logger.error('Failed to track shipment:', error);
    next(error);
  }
};

/**
 * Cancel shipment
 * POST /api/admin/shiprocket/cancel-shipment
 */
const cancelShipment = async (req, res, next) => {
  try {
    const { orderId, orderType = 'regular' } = req.body;

    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.shiprocket?.awbCode) {
      return res.status(400).json({
        success: false,
        message: 'No AWB found. Shipment may not be created yet.'
      });
    }

    const cancelResponse = await shiprocketService.cancelShipment([order.shiprocket.awbCode]);

    order.shiprocket.status = 'cancelled';
    order.shiprocket.lastSyncedAt = new Date();
    order.status = 'cancelled';
    await order.save();

    logger.info('Shipment cancelled:', {
      orderId,
      orderType,
      awbCode: order.shiprocket.awbCode,
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Shipment cancelled successfully',
      data: cancelResponse
    });
  } catch (error) {
    logger.error('Failed to cancel shipment:', error);
    next(error);
  }
};

/**
 * Generate shipping label
 * POST /api/admin/shiprocket/generate-label
 */
const generateLabel = async (req, res, next) => {
  try {
    const { orderId, orderType = 'regular' } = req.body;

    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.shiprocket?.shipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Shipment not created yet'
      });
    }

    const labelResponse = await shiprocketService.generateLabel([order.shiprocket.shipmentId]);

    order.shiprocket.labelUrl = labelResponse.label_url;
    order.shiprocket.lastSyncedAt = new Date();
    await order.save();

    res.json({
      success: true,
      message: 'Label generated successfully',
      data: {
        labelUrl: labelResponse.label_url
      }
    });
  } catch (error) {
    logger.error('Failed to generate label:', error);
    next(error);
  }
};

/**
 * Generate manifest
 * POST /api/admin/shiprocket/generate-manifest
 */
const generateManifest = async (req, res, next) => {
  try {
    const { orderIds, orderType = 'regular' } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderIds array is required'
      });
    }

    const shipmentIds = [];
    for (const orderId of orderIds) {
      let order;
      if (orderType === 'custom') {
        order = await CustomOrder.findById(orderId);
      } else {
        order = await Order.findById(orderId);
      }

      if (order && order.shiprocket?.shipmentId) {
        shipmentIds.push(order.shiprocket.shipmentId);
      }
    }

    if (shipmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid shipments found for the provided order IDs'
      });
    }

    const manifestResponse = await shiprocketService.generateManifest(shipmentIds);

    // Update orders with manifest URL
    for (const orderId of orderIds) {
      let order;
      if (orderType === 'custom') {
        order = await CustomOrder.findById(orderId);
      } else {
        order = await Order.findById(orderId);
      }

      if (order && order.shiprocket?.shipmentId) {
        order.shiprocket.manifestUrl = manifestResponse.manifest_url;
        order.shiprocket.lastSyncedAt = new Date();
        await order.save();
      }
    }

    res.json({
      success: true,
      message: 'Manifest generated successfully',
      data: {
        manifestUrl: manifestResponse.manifest_url,
        shipmentIds: shipmentIds
      }
    });
  } catch (error) {
    logger.error('Failed to generate manifest:', error);
    next(error);
  }
};

/**
 * Webhook handler for Shiprocket status updates
 * POST /api/shiprocket/webhook
 */
const handleWebhook = async (req, res, next) => {
  try {
    // Support raw body (from express.raw) for signature verification.
    // If raw buffer is present, verify HMAC-SHA256 using
    // process.env.SHIPROCKET_WEBHOOK_SECRET and then parse JSON.
    let webhookData;
    const rawBody = req.body;

    if (Buffer.isBuffer(rawBody)) {
      const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
      const sigHeader = (req.get('x-shiprocket-signature') || req.get('x-signature') || req.get('x-shiprocket-hmac') || req.get('x-hub-signature-256') || req.get('signature') || '').toString();

      if (secret) {
        if (!sigHeader) {
          logger.warn('Missing Shiprocket signature header');
          return res.status(401).json({ success: false, message: 'Missing signature header' });
        }

        // Normalize header (remove sha256= prefix if present)
        let received = sigHeader;
        if (received.startsWith('sha256=')) received = received.slice(7);

        const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

        const receivedBuf = Buffer.from(received, 'utf8');
        const expectedHexBuf = Buffer.from(expectedHex, 'utf8');
        const expectedBase64Buf = Buffer.from(expectedBase64, 'utf8');

        let verified = false;
        try {
          if (receivedBuf.length === expectedHexBuf.length && crypto.timingSafeEqual(receivedBuf, expectedHexBuf)) verified = true;
          else if (receivedBuf.length === expectedBase64Buf.length && crypto.timingSafeEqual(receivedBuf, expectedBase64Buf)) verified = true;
        } catch (e) {
          verified = false;
        }

        if (!verified) {
          logger.warn('Invalid Shiprocket webhook signature');
          return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
      } else {
        logger.error('SHIPROCKET_WEBHOOK_SECRET not configured; rejecting webhook');
        return res.status(500).json({ success: false, message: 'Server misconfiguration: SHIPROCKET_WEBHOOK_SECRET not set' });
      }

      // Parse JSON after successful verification (or if secret absent)
      webhookData = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
    } else {
      // Fallback if body already parsed by other middleware
      webhookData = req.body;
    }

    logger.info('Shiprocket webhook received:', webhookData);

    // Extract order ID from webhook (format: ORD-xxxxx or CUST-xxxxx)
    const orderIdFromShiprocket = webhookData.order_id;
    
    // Handle test webhooks from ShipRocket
    if (!orderIdFromShiprocket || orderIdFromShiprocket === 'test' || orderIdFromShiprocket.includes('test')) {
      logger.info('Test webhook received from ShipRocket');
      return res.json({
        success: true,
        message: 'Test webhook acknowledged successfully',
        isTest: true
      });
    }

    const isCustomOrder = orderIdFromShiprocket.startsWith('CUST-');
    const mongoOrderId = orderIdFromShiprocket.replace(/^(ORD-|CUST-)/, '');

    let order;
    if (isCustomOrder) {
      order = await CustomOrder.findById(mongoOrderId);
    } else {
      order = await Order.findById(mongoOrderId);
    }

    if (!order) {
      logger.warn('Order not found for webhook:', orderIdFromShiprocket);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status based on Shiprocket status
    const shiprocketStatus = webhookData.current_status?.toLowerCase();
    
    if (!order.shiprocket) {
      order.shiprocket = {};
    }

    order.shiprocket.status = shiprocketStatus;
    order.shiprocket.statusCode = webhookData.status_code;
    order.shiprocket.lastSyncedAt = new Date();

    // Map Shiprocket status to our order status
    if (shiprocketStatus === 'shipped' || shiprocketStatus === 'in transit') {
      order.status = 'shipped';
    } else if (shiprocketStatus === 'delivered') {
      order.status = 'delivered';
    } else if (shiprocketStatus === 'cancelled' || shiprocketStatus === 'rto') {
      order.status = 'cancelled';
      order.shiprocket.rtoReason = webhookData.reason;
    } else if (shiprocketStatus === 'on hold') {
      order.shiprocket.onHoldReason = webhookData.reason;
    }

    // Update AWB if present
    if (webhookData.awb) {
      order.shiprocket.awbCode = webhookData.awb;
      order.trackingNumber = webhookData.awb;
    }

    await order.save();

    // Emit real-time update via socket.io if available
    try {
      const { io } = require('../index');
      if (io) {
        io.to(String(order._id)).emit('orderStatusUpdate', {
          orderId: order._id,
          status: order.status,
          trackingNumber: order.trackingNumber,
          shiprocketStatus: shiprocketStatus
        });
      }
    } catch (err) {
      logger.warn('Socket.io emit failed:', err);
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Webhook processing failed:', error);
    next(error);
  }
};

/**
 * Check serviceability for pincode
 * GET /api/shiprocket/check-serviceability
 */
const checkServiceability = async (req, res, next) => {
  try {
    const { pickupPincode, deliveryPincode, weight, cod } = req.query;

    if (!pickupPincode || !deliveryPincode) {
      return res.status(400).json({
        success: false,
        message: 'Both pickup and delivery pincodes are required'
      });
    }

    const serviceabilityData = await shiprocketService.checkServiceability(
      pickupPincode,
      deliveryPincode,
      cod ? parseFloat(cod) : 0,
      weight ? parseFloat(weight) : 0.5
    );

    const isServiceable = serviceabilityData.data?.available_courier_companies?.length > 0;

    res.json({
      success: true,
      data: {
        serviceable: isServiceable,
        couriers: serviceabilityData.data?.available_courier_companies || [],
        message: isServiceable ? 'Delivery available' : 'Delivery not available for this location'
      }
    });
  } catch (error) {
    logger.error('Serviceability check failed:', error);
    next(error);
  }
};

/**
 * Get pickup locations
 * GET /api/admin/shiprocket/pickup-locations
 */
const getPickupLocations = async (req, res, next) => {
  try {
    const locations = await shiprocketService.getPickupLocations();

    res.json({
      success: true,
      data: {
        locations: locations
      }
    });
  } catch (error) {
    logger.error('Failed to get pickup locations:', error);
    next(error);
  }
};

module.exports = {
  createShipment,
  assignCourier,
  getRecommendedCouriers,
  requestPickup,
  trackShipment,
  cancelShipment,
  generateLabel,
  generateManifest,
  handleWebhook,
  checkServiceability,
  getPickupLocations
};
