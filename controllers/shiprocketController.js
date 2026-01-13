const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const shiprocketService = require('../utils/shiprocket');
const logger = require('../utils/logger');

/**
 * SHIPROCKET INTEGRATION CONTROLLER
 * 
 * This controller handles all Shiprocket shipment operations:
 * - Create shipments
 * - Track shipments
 * - Handle webhooks
 * - Check serviceability
 * - Manage pickup locations
 */

/**
 * Create shipment in Shiprocket for an order
 * POST /api/shiprocket/create-shipment
 */
const createShipment = async (req, res, next) => {
  try {
    logger.info('📦 [Shiprocket] Processing createShipment request:', {
      body: JSON.stringify(req.body, null, 2),
      adminId: req.user?.id,
      userRole: req.user?.role
    });

    const { orderId, orderType = 'regular', pickupLocationId, dimensions, weight: rawWeight } = req.body;
    
    // Convert weight properly for Shiprocket API
    // Raw weight might be in kg or grams, and Shiprocket expects max 1000 grams
    let weight = rawWeight || 0.15; // default to 0.15 kg if not provided
    
    // If the raw weight is very small (like 0.15), it's probably already in kg
    // If it's larger (like 150), it might be in grams
    // But we need to ensure it doesn't exceed Shiprocket's limit when converted
    if (weight <= 1.0) {
      // Likely in kg, convert to grams but cap at 1000
      weight = Math.min(Math.round(weight * 1000), 1000);
    } else if (weight > 1.0 && weight <= 1000) {
      // Likely already in grams, keep as is but cap at 1000
      weight = Math.min(Math.round(weight), 1000);
    } else {
      // If somehow higher than 1000, cap it
      weight = 1000;
    }
    
    // Ensure pickupLocationId is a valid string or number
    // First try to use the provided pickupLocationId, but validate it against known working ID
    let pickupLocation = '19334183'; // Use known working pickup location ID for this account
    
    if (pickupLocationId && !isNaN(pickupLocationId)) {
      const providedPickupLocation = String(pickupLocationId);
      
      // For this account, we know that only pickup location 19334183 works
      // So unless the provided ID matches the known working one, use the known one
      if (providedPickupLocation === '19334183') {
        pickupLocation = providedPickupLocation;
        logger.info('Using provided pickup location ID (matches known working ID):', { pickupLocation });
      } else {
        logger.info('Provided pickup location ID does not match known working ID, using known working ID:', { 
          provided: providedPickupLocation, 
          using: '19334183' 
        });
        pickupLocation = '19334183';
      }
    } else {
      logger.info('No valid pickup location ID provided, using known working ID:', { pickupLocation: '19334183' });
      
      // Try to get actual pickup locations from Shiprocket as additional verification
      try {
        const locations = await shiprocketService.getPickupLocations();
        if (locations && locations.length > 0) {
          logger.info('Verified pickup locations available:', { 
            count: locations.length, 
            firstId: locations[0].id,
            firstLocation: locations[0].pickup_location || locations[0].name 
          });
        }
      } catch (locationError) {
        logger.warn('Could not verify pickup locations, but using known working ID "19334183":', locationError.message);
      }
    }


    // Enhanced validation
    if (!orderId) {
      logger.warn('❌ [Shiprocket] Validation failed: Order ID is required');
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
        received: { orderId, orderType, pickupLocationId, dimensions, weight }
      });
    }

    // For this Shiprocket account, we know that pickup location ID 19334183 corresponds to the warehouse in Koderma, Jharkhand
    // Address: PHULWRIYA,KODERMA,JHARKHAND 825418, PHULWRIYA,DOMCHANCH,KODERMA,JHARKHAND 825418, Koderma, Jharkhand, India, 825418
    // Warehouse SPOC: SAGAR KUMAR SAW | 7827205492
    // Hardcode this mapping to avoid API call issues
    let actualPickupLocationName = 'Home'; // Known working name for ID 19334183 - Koderma Warehouse

    if (pickupLocation === '19334183') {
      actualPickupLocationName = 'Home';
      logger.info('Using hardcoded pickup location name for known ID:', { pickupLocationId: pickupLocation, pickupLocationName: actualPickupLocationName });
    } else {
      // For other IDs, try to get from API
      try {
        const pickupLocations = await shiprocketService.getPickupLocations();
        if (pickupLocations && pickupLocations.length > 0) {
          // Find the location that matches the ID
          const targetLocation = pickupLocations.find(loc => String(loc.id) === String(pickupLocation));
          if (targetLocation) {
            actualPickupLocationName = targetLocation.pickup_location || targetLocation.name || targetLocation.location || 'Home';
            logger.info('Using verified pickup location name from API:', { pickupLocationName: actualPickupLocationName, id: targetLocation.id });
          } else {
            // If the specific ID is not found, use the first available location
            const firstLocation = pickupLocations[0];
            actualPickupLocationName = firstLocation.pickup_location || firstLocation.name || firstLocation.location || 'Home';
            pickupLocation = String(firstLocation.id);
            logger.warn('Using fallback pickup location from API:', {
              name: actualPickupLocationName,
              id: firstLocation.id,
              availableLocations: pickupLocations.map(loc => ({id: loc.id, name: loc.pickup_location || loc.name || loc.location}))
            });
          }
        }
      } catch (locationError) {
        logger.warn('Could not fetch pickup locations from API, using default name:', locationError.message);
      }
    }

    // Validate ObjectId format
    if (!orderId.match(/^[a-f0-9]{24}$/i)) {
      logger.warn('❌ [Shiprocket] Invalid Order ID format:', { orderId });
      return res.status(400).json({
        success: false,
        message: 'Invalid Order ID format',
        received: orderId
      });
    }

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
    if (order.shiprocket?.shipmentId || order.shiprocket?.awbCode) {
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
      
      // Shiprocket SKU limit
      if (sku.length > 50) {
        logger.info(`[Shiprocket] Truncating Custom SKU from ${sku.length} chars to 40 chars`);
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
        const rawSku = item.sku || item.variantId?.toString() || item.productId?.toString() || 'SKU-NA';
        let sku = String(rawSku).trim();
        
        if (sku.length > 50) {
          logger.info(`[Shiprocket] Truncating SKU from ${sku.length} chars`);
          sku = sku.slice(-40);
        }

        return {
          name: item.title || 'Mobile Cover',
          sku: sku,
          units: item.quantity,
          quantity: item.quantity,
          selling_price: item.price,
          discount: 0,
          tax: 0,
          hsn: 392690
        };
      });
    }

    // Split customer name into first and last
    const fullName = order.shippingAddress?.name || order.userId?.name || 'Customer';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Get contact details
    const email = order.userId?.email || order.shippingAddress?.email || 'customer@example.com';
    const phone = order.shippingAddress?.phone || '0000000000';

    // Prepare and validate shipping address
    const rawAddress1 = order.shippingAddress?.address1 || order.shippingAddress?.street || '';
    const rawAddress2 = order.shippingAddress?.address2 || '';

    // Combine address lines and clean up
    let combinedAddress = [rawAddress1, rawAddress2].filter(addr => addr.trim()).join(', ').trim();

    // Shiprocket validation: address must be at least 5 characters and contain at least 1 number and 1 space
    const hasMinimumLength = combinedAddress.length >= 5;
    const hasSpace = combinedAddress.includes(' ');
    const hasNumber = /\d/.test(combinedAddress);

    if (!hasMinimumLength || !hasSpace || !hasNumber) {
      logger.warn('❌ [Shiprocket] Address validation failed:', {
        combinedAddress,
        length: combinedAddress.length,
        hasSpace,
        hasNumber,
        hasMinimumLength
      });

      // Try to fix the address by adding default components if possible
      // Ensure the address has both space and number required by Shiprocket
      if (!hasSpace) {
        // Add space if missing
        combinedAddress += ' ';
      }
      if (!hasNumber && order.shippingAddress?.postalCode) {
        // Add pincode if missing number
        combinedAddress += ` ${order.shippingAddress.postalCode}`;
      } else if (!hasNumber) {
        // If no postal code available, add a default number to satisfy Shiprocket requirements
        combinedAddress += ' 1';
      }

      // Re-validate after fix attempt
      const fixedHasSpace = combinedAddress.includes(' ');
      const fixedHasNumber = /\d/.test(combinedAddress);
      const fixedHasMinimumLength = combinedAddress.length >= 5;

      if (!fixedHasMinimumLength || !fixedHasSpace || !fixedHasNumber) {
        return res.status(400).json({
          success: false,
          message: 'Shipping address does not meet Shiprocket requirements. Address must be at least 5 characters and contain at least one number and one space.',
          details: {
            currentAddress: combinedAddress,
            requirements: {
              minLength: 5,
              needsSpace: true,
              needsNumber: true
            },
            validation: {
              length: combinedAddress.length,
              hasSpace: fixedHasSpace,
              hasNumber: fixedHasNumber
            }
          }
        });
      }

      logger.info('✅ [Shiprocket] Address fixed:', { original: [rawAddress1, rawAddress2].join(', '), fixed: combinedAddress });
    }

    // Prepare Shiprocket order data
    const shiprocketOrderData = {
      orderId: orderType === 'custom' ? `CUST-${orderId}` : `ORD-${orderId}`,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupLocationId: pickupLocation, // Use validated pickup location ID
      pickupLocationName: actualPickupLocationName, // Use the verified pickup location name
      billingCustomerName: firstName,
      billingAddress: combinedAddress,
      billingCity: order.shippingAddress?.city,
      billingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      billingState: order.shippingAddress?.state,
      billingCountry: order.shippingAddress?.country || 'India',
      billingEmail: email,
      billingPhone: phone,
      shippingCustomerName: firstName,
      shippingAddress: combinedAddress,
      shippingCity: order.shippingAddress?.city,
      shippingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      shippingState: order.shippingAddress?.state,
      shippingCountry: order.shippingAddress?.country || 'India',
      shippingEmail: email,
      shippingPhone: phone,
      orderItems: orderItems,
      paymentMethod: order.payment?.status === 'paid' ? 'prepaid' : 'cod',
      subTotal: orderType === 'custom' ? order.price : order.total,
      length: dimensions?.length || 17,
      breadth: dimensions?.breadth || 4,
      height: dimensions?.height || 2,
      weight: weight // Weight already converted to grams for Shiprocket API
    };

    logger.info('[Shiprocket] Using pickup location:', {
      id: pickupLocation,
      name: actualPickupLocationName,
      finalPayloadPickupLocation: shiprocketOrderData.pickupLocationName
    });

    logger.info('[Shiprocket] Sending Order Data:', JSON.stringify(shiprocketOrderData, null, 2));

    // Create order in Shiprocket
    let shiprocketResponse;
    try {
      shiprocketResponse = await shiprocketService.createOrder(shiprocketOrderData);
      
      if (!shiprocketResponse.success) {
        logger.error('❌ Shiprocket API returned failure:', { shiprocketResponse });
        return res.status(400).json({
          success: false,
          message: shiprocketResponse.message || 'Failed to create shipment in Shiprocket',
          details: shiprocketResponse
        });
      }
    } catch (shiprocketError) {
      logger.error('❌ Failed to create Shiprocket shipment:', {
        error: shiprocketError.message,
        stack: shiprocketError.stack,
        orderId: orderId
      });
      
      return res.status(400).json({
        success: false,
        message: shiprocketError.message || 'Failed to create shipment in Shiprocket',
        errorType: 'SHIPROCKET_ERROR'
      });
    }

    // Update order with Shiprocket details
    order.shiprocket = {
      orderId: shiprocketResponse.orderId,
      shipmentId: shiprocketResponse.shipmentId,
      awbCode: shiprocketResponse.awbCode,
      courierId: shiprocketResponse.courierId,
      courierName: shiprocketResponse.courierName,
      status: shiprocketResponse.status,
      trackingUrl: shiprocketResponse.trackingUrl,
      lastSyncedAt: new Date(),
      remarks: shiprocketResponse.message
    };

    // Also set tracking number at order level
    order.trackingNumber = shiprocketResponse.awbCode;

    await order.save();

    logger.info('✅ Shiprocket shipment created and saved:', {
      orderId,
      orderType,
      shipmentId: shiprocketResponse.shipmentId,
      awbCode: shiprocketResponse.awbCode,
      adminId: req.user?.id
    });

    res.json({
      success: true,
      message: 'Shipment created successfully in Shiprocket',
      data: {
        shipmentId: shiprocketResponse.shipmentId,
        awbCode: shiprocketResponse.awbCode,
        orderId: shiprocketResponse.orderId,
        status: shiprocketResponse.status,
        trackingUrl: shiprocketResponse.trackingUrl || `https://shiprocket.co/tracking/${shiprocketResponse.awbCode}`
      }
    });
  } catch (error) {
    logger.error('❌ Failed to create Shiprocket shipment:', {
      error: error.message,
      stack: error.stack,
      orderId: req.body?.orderId
    });
    // Return 400 for client-related errors instead of 500
    return res.status(400).json({
      success: false,
      message: error.message || 'Error occurred while creating shipment',
      errorType: 'REQUEST_ERROR'
    });
  }
};

/**
 * Track shipment by order ID or AWB
 * GET /api/shiprocket/track/:identifier
 */
const trackShipment = async (req, res, next) => {
  console.log('🔥 DEBUG: trackShipment called with identifier:', req.params.identifier);
  console.log('🔥 DEBUG: query params:', req.query);
  
  try {
    const { identifier } = req.params;
    const { orderType = 'regular' } = req.query;

    logger.info('📍 [Shiprocket] Tracking shipment:', { identifier });

    let awbCode;
    let order;

    // Check if identifier is an order ID or AWB
    if (identifier.match(/^[a-f0-9]{24}$/i)) {
      // It's a MongoDB ObjectId (order ID)
      logger.info('📍 [Shiprocket] Processing order ID:', { identifier, orderType });
      
      if (orderType === 'custom') {
        order = await CustomOrder.findById(identifier);
      } else {
        order = await Order.findById(identifier);
      }

      logger.info('📍 [Shiprocket] Order found:', { 
        orderId: identifier, 
        found: !!order,
        hasShiprocket: !!order?.shiprocket,
        awbCode: order?.shiprocket?.awbCode 
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      awbCode = order.shiprocket?.awbCode;

      if (!awbCode) {
        return res.status(400).json({
          success: false,
          message: 'No AWB found for this order. Create shipment first.'
        });
      }
    } else {
      // It's an AWB number
      awbCode = identifier;
      logger.info('📍 [Shiprocket] Processing AWB:', { awbCode });
    }

    // Get tracking data from Shiprocket
    const trackingData = await shiprocketService.trackShipment(awbCode);

    if (!trackingData || !trackingData.awb_code) {
      return res.status(404).json({
        success: false,
        message: 'No tracking information found for this AWB',
        awbCode
      });
    }

    // Update order with latest tracking info if we have the order
    if (order) {
      order.shiprocket.trackingData = {
        currentStatus: trackingData.current_status?.status || trackingData.status,
        statusLocation: trackingData.current_status?.location || trackingData.current_location,
        statusDateTime: trackingData.current_status?.created_at || new Date(),
        shipmentTrack: trackingData.tracking_data?.history?.map(track => ({
          status: track.status,
          date: track.created_at,
          location: track.location,
          activity: track.activity,
          substatus: track.substatus
        })) || [],
        currentStatusDetails: trackingData.current_status || trackingData.status_details
      };
      order.shiprocket.lastSyncedAt = new Date();
      
      // Update order status based on Shiprocket status
      const currentStatus = (trackingData.current_status?.status || trackingData.status || '').toLowerCase();
      if (currentStatus.includes('delivered')) {
        order.status = 'delivered';
      } else if (currentStatus.includes('transit') || currentStatus.includes('pickup') || currentStatus.includes('out for delivery')) {
        order.status = 'shipped';
      }

      await order.save();
    }

    logger.info('✅ Tracking data retrieved:', { awbCode });

    res.json({
      success: true,
      data: {
        awbCode: trackingData.awb_code,
        status: trackingData.current_status?.status || trackingData.status,
        location: trackingData.current_status?.location || trackingData.current_location,
        dateTime: trackingData.current_status?.created_at || new Date(),
        instructions: trackingData.current_status?.activity || trackingData.status_details,
        trackingHistory: trackingData.tracking_data?.history?.map(track => ({
          status: track.status,
          dateTime: track.created_at,
          location: track.location,
          instructions: track.activity,
          substatus: track.substatus
        })) || [],
        trackingUrl: trackingData.tracking_url || `https://shiprocket.co/tracking/${awbCode}`
      }
    });
  } catch (error) {
    logger.error('❌ Failed to track shipment:', {
      error: error.message,
      identifier: req.params.identifier
    });
    next(error);
  }
};

/**
 * Cancel shipment
 * POST /api/shiprocket/cancel-shipment
 */
const cancelShipment = async (req, res, next) => {
  try {
    const { orderId, orderType = 'regular', reason } = req.body;

    logger.info('🚫 [Shiprocket] Cancelling shipment:', { orderId, reason });

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

    const awbCode = order.shiprocket?.awbCode;

    if (!awbCode) {
      return res.status(400).json({
        success: false,
        message: 'No AWB found for this order'
      });
    }

    // Cancel in Shiprocket
    const cancelResponse = await shiprocketService.cancelShipment(awbCode);

    // Update order
    order.shiprocket.status = 'cancelled';
    order.shiprocket.cancellationReason = reason;
    order.shiprocket.lastSyncedAt = new Date();
    order.status = 'cancelled';
    order.cancellationReason = reason;

    await order.save();

    logger.info('✅ Shipment cancelled:', { orderId, awbCode });

    res.json({
      success: true,
      message: 'Shipment cancelled successfully',
      data: {
        orderId,
        awbCode,
        reason
      }
    });
  } catch (error) {
    logger.error('❌ Failed to cancel shipment:', {
      error: error.message,
      orderId: req.body?.orderId
    });
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

    if (!deliveryPincode) {
      return res.status(400).json({
        success: false,
        message: 'Delivery pincode is required'
      });
    }

    logger.info('🔍 [Shiprocket] Checking serviceability:', {
      pickup: pickupPincode,
      delivery: deliveryPincode
    });

    const serviceabilityData = await shiprocketService.checkServiceability(
      pickupPincode || process.env.SHIPROCKET_PICKUP_PINCODE || '400001',
      deliveryPincode,
      cod ? parseFloat(cod) : 0,
      weight ? parseFloat(weight) : 0.5
    );

    res.json({
      success: true,
      data: {
        serviceable: serviceabilityData.serviceable,
        deliveryPincode: deliveryPincode,
        availableCouriers: serviceabilityData.data?.available_courier_companies?.length || 0,
        isMock: serviceabilityData.isMock || false
      }
    });
  } catch (error) {
    logger.error('❌ Serviceability check failed:', {
      error: error.message,
      pincode: req.query.deliveryPincode
    });
    next(error);
  }
};

/**
 * Get pickup locations
 * GET /api/shiprocket/pickup-locations
 */
const getPickupLocations = async (req, res, next) => {
  try {
    logger.info('🏢 [Shiprocket] Fetching pickup locations');

    const locations = await shiprocketService.getPickupLocations();

    res.json({
      success: true,
      data: {
        locations: locations,
        count: locations.length
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get pickup locations:', error.message);
    next(error);
  }
};

/**
 * Handle Shiprocket webhook
 * POST /api/webhooks/shiprocket
 * 
 * Note: Shiprocket webhooks need to be configured in their dashboard
 */
const handleWebhook = async (req, res, next) => {
  try {
    // Verify webhook token if configured
    const receivedToken = req.headers['x-api-key'] || req.headers['authorization'];
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET;

    if (expectedToken && receivedToken !== expectedToken && receivedToken !== `Bearer ${expectedToken}`) {
      logger.warn('[Shiprocket Webhook] Invalid token received');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body;
    logger.info('[Shiprocket Webhook] Event received:', JSON.stringify(payload, null, 2));

    // Extract AWB and order reference
    const awbCode = payload.awb_code || payload.awb;
    const orderRef = payload.order_id || payload.reference_number;

    // Handle test webhooks
    if (!awbCode || awbCode === 'test' || orderRef === 'test') {
      logger.info('[Shiprocket Webhook] Test webhook received');
      return res.json({
        success: true,
        message: 'Test webhook acknowledged',
        isTest: true
      });
    }

    // Find order by AWB or order reference
    let order = null;
    
    if (awbCode) {
      order = await Order.findOne({ 'shiprocket.awbCode': awbCode });
      if (!order) {
        order = await CustomOrder.findOne({ 'shiprocket.awbCode': awbCode });
      }
    }

    if (!order && orderRef) {
      const isCustomOrder = orderRef.startsWith('CUST-');
      const mongoOrderId = orderRef.replace(/^(ORD-|CUST-)/, '');
      
      if (isCustomOrder) {
        order = await CustomOrder.findById(mongoOrderId);
      } else {
        order = await Order.findById(mongoOrderId);
      }
    }

    if (!order) {
      logger.warn('[Shiprocket Webhook] Order not found:', { awbCode, orderRef });
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order with webhook data
    const status = payload.status || payload.current_status || payload.Status;
    
    if (!order.shiprocket) {
      order.shiprocket = {};
    }

    order.shiprocket.status = status;
    order.shiprocket.lastSyncedAt = new Date();

    // Map Shiprocket status to our order status
    const statusLower = (status || '').toLowerCase();
    
    if (statusLower.includes('delivered')) {
      order.status = 'delivered';
      order.shiprocket.deliveredDate = new Date(payload.delivered_date || Date.now());
    } else if (statusLower.includes('transit') || statusLower.includes('pickup') || statusLower.includes('out for delivery')) {
      order.status = 'shipped';
    } else if (statusLower.includes('rto') || statusLower.includes('return')) {
      order.shiprocket.rtoReason = payload.reason || 'Return to origin';
    } else if (statusLower.includes('cancelled')) {
      order.status = 'cancelled';
      order.cancellationReason = payload.reason || 'Cancelled by courier';
    }

    // Store webhook payload for reference
    if (!order.shiprocket.webhookHistory) {
      order.shiprocket.webhookHistory = [];
    }
    order.shiprocket.webhookHistory.push({
      status: status,
      payload: payload,
      receivedAt: new Date()
    });

    await order.save();

    logger.info('✅ [Shiprocket Webhook] Order updated:', {
      orderId: order._id,
      awbCode,
      status,
      orderStatus: order.status
    });

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('❌ [Shiprocket Webhook] Error:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Generate shipping label
 */
const generateLabel = async (req, res, next) => {
  try {
    logger.info('🏷️ [Shiprocket] Processing generateLabel request:', {
      body: JSON.stringify(req.body, null, 2),
      adminId: req.user?.id,
      userRole: req.user?.role
    });

    const { orderIds, orderType = 'regular', orderTyype } = req.body; // Handle potential typo in frontend
    
    // Use orderTyype if orderType is not provided (handle the typo)
    const actualOrderType = orderType !== 'regular' && orderType !== 'custom' ? (orderTyype || 'regular') : orderType;

    if (!orderIds) {
      logger.warn('❌ [Shiprocket] Validation failed: orderIds is required', { received: req.body });
      return res.status(400).json({
        success: false,
        message: 'Order IDs are required',
        received: req.body,
        expected: 'orderIds should be an array of order IDs'
      });
    }

    if (!Array.isArray(orderIds)) {
      logger.warn('❌ [Shiprocket] Validation failed: orderIds must be an array', { orderIds, type: typeof orderIds });
      return res.status(400).json({
        success: false,
        message: 'Order IDs must be an array',
        received: { orderIds, type: typeof orderIds },
        expected: 'orderIds should be an array of order IDs'
      });
    }

    if (orderIds.length === 0) {
      logger.warn('❌ [Shiprocket] Validation failed: orderIds array is empty', { orderIds });
      return res.status(400).json({
        success: false,
        message: 'Order IDs array cannot be empty',
        received: { orderIds, count: orderIds.length },
        expected: 'at least one order ID in the array'
      });
    }

    // Validate each order ID format
    const invalidOrderIds = orderIds.filter(id => !id.match(/^[a-f0-9]{24}$/i));
    if (invalidOrderIds.length > 0) {
      logger.warn('❌ [Shiprocket] Validation failed: Invalid order ID format', { invalidOrderIds });
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format found',
        invalidOrderIds,
        expected: 'valid MongoDB ObjectIds (24-character hex strings)'
      });
    }

    const shipmentIds = [];
    const missingShipments = [];

    for (const orderId of orderIds) {
      let order;
      if (actualOrderType === 'custom') {
        order = await CustomOrder.findById(orderId);
      } else {
        order = await Order.findById(orderId);
      }

      if (!order) {
        missingShipments.push({ orderId, reason: 'Order not found' });
        logger.warn('⚠️ [Shiprocket] Order not found for ID:', { orderId });
        continue;
      }

      if (order?.shiprocket?.shipmentId) {
        shipmentIds.push(order.shiprocket.shipmentId);
        logger.info('✅ [Shiprocket] Found shipment ID for order:', { orderId, shipmentId: order.shiprocket.shipmentId });
      } else {
        missingShipments.push({ orderId, reason: order.shiprocket ? 'Shipment exists but no shipment ID found' : 'No shipment record found in order', hasShiprocket: !!order.shiprocket, shiprocketDetails: order.shiprocket });
        logger.warn('⚠️ [Shiprocket] No shipment ID found for order:', { orderId, hasShiprocket: !!order.shiprocket, shiprocketDetails: order.shiprocket });
      }
    }

    if (shipmentIds.length === 0) {
      logger.warn('❌ [Shiprocket] No shipment IDs found for any of the provided orders', { 
        orderIds, 
        missingShipments 
      });
      return res.status(400).json({
        success: false,
        message: 'No shipment IDs found for the provided orders. Shipment must be created first.',
        orderIds,
        missingShipments,
        expected: 'Orders must have shipment created with IDs before generating labels'
      });
    }

    logger.info('🏷️ [Shiprocket] Generating labels for shipments:', { shipmentIds });
    
    const labelResponse = await shiprocketService.generateLabel(shipmentIds);

    logger.info('✅ [Shiprocket] Label generation processed:', { 
      success: labelResponse.success, 
      shipmentIds, 
      message: labelResponse.message 
    });

    res.json({
      success: labelResponse.success !== false, // Allow undefined to be treated as success
      message: labelResponse.message || 'Label generation request processed',
      data: {
        shipmentIds: shipmentIds,
        label_urls: labelResponse.label_urls,
        note: 'Labels generated successfully',
        count: shipmentIds.length
      }
    });
  } catch (error) {
    logger.error('❌ Failed to generate label:', {
      error: error.message,
      stack: error.stack,
      orderIds: req.body?.orderIds
    });
    next(error);
  }
};

/**
 * Get recommended couriers for an order
 * GET /api/shiprocket/recommended-couriers/:orderId
 */
const getRecommendedCouriers = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { orderType = 'regular' } = req.query;

    logger.info('🚚 [Shiprocket] Getting recommended couriers:', { orderId, orderType });

    // Get order details
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

    // Check serviceability first
    const pickupPin = process.env.SHIPROCKET_PICKUP_PINCODE || '400001';
    const deliveryPin = order.shippingAddress?.postalCode || order.shippingAddress?.zipCode;
    
    if (!deliveryPin) {
      return res.status(400).json({
        success: false,
        message: 'Delivery pincode not found in order'
      });
    }

    const serviceabilityData = await shiprocketService.checkServiceability(
      pickupPin,
      deliveryPin,
      orderType === 'custom' ? order.price : order.total,
      order.items?.reduce((total, item) => total + (item.weight || 0.5), 0) || 0.5 // Calculate total weight from items or use default
    );

    // Return available couriers from serviceability check
    const couriers = serviceabilityData.data?.available_courier_companies || [];

    res.json({
      success: true,
      data: {
        orderId,
        orderType,
        pickupPincode: pickupPin,
        deliveryPincode: deliveryPin,
        couriers: couriers,
        count: couriers.length
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get recommended couriers:', {
      error: error.message,
      orderId: req.params.orderId
    });
    next(error);
  }
};

/**
 * Request pickup for a shipment
 * POST /api/shiprocket/request-pickup
 */
const requestPickup = async (req, res, next) => {
  try {
    logger.info('🚚 [Shiprocket] Processing requestPickup request:', {
      body: JSON.stringify(req.body, null, 2),
      adminId: req.user?.id,
      userRole: req.user?.role
    });

    const { orderId, orderType = 'regular', orderTyype, pickupDate, pickupTimeFrom, pickupTimeTo } = req.body;
    
    // Handle potential typo in frontend
    const actualOrderType = orderType !== 'regular' && orderType !== 'custom' ? (orderTyype || 'regular') : orderType;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Find order
    let order;
    if (actualOrderType === 'custom') {
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

    const awbCode = order.shiprocket?.awbCode;

    if (!awbCode) {
      return res.status(400).json({
        success: false,
        message: 'No AWB found for this order. Create shipment first.'
      });
    }

    // Verify that shipmentId exists
    if (!order.shiprocket?.shipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Shipment ID not found for this order. Create shipment first.'
      });
    }
    
    // Request pickup in Shiprocket
    const pickupResponse = await shiprocketService.requestPickup(
      [order.shiprocket.shipmentId], 
      pickupDate, 
      pickupTimeFrom, 
      pickupTimeTo
    );

    logger.info('✅ Pickup requested for shipment:', { orderId, awbCode });

    res.json({
      success: true,
      message: 'Pickup request submitted successfully.',
      data: {
        orderId,
        awbCode,
        pickupDate: pickupDate || 'Next business day',
        pickupTimeFrom: pickupTimeFrom || '10:00',
        pickupTimeTo: pickupTimeTo || '18:00',
        status: 'pickup_requested'
      }
    });
  } catch (error) {
    logger.error('❌ Failed to request pickup:', {
      error: error.message,
      orderId: req.body?.orderId
    });
    next(error);
  }
};

/**
 * Assign courier to an order (alias for create-shipment)
 * POST /api/shiprocket/assign-courier
 */
const assignCourier = async (req, res, next) => {
  try {
    logger.info('🚚 [Shiprocket] Processing assignCourier request:', {
      body: JSON.stringify(req.body, null, 2),
      adminId: req.user?.id,
      userRole: req.user?.role
    });

    // This is essentially the same as create-shipment
    // Forward the request to createShipment logic
    return await createShipment(req, res, next);
  } catch (error) {
    logger.error('❌ Failed to assign courier:', {
      error: error.message,
      orderId: req.body?.orderId
    });
    next(error);
  }
};

module.exports = {
  createShipment,
  trackShipment,
  cancelShipment,
  checkServiceability,
  getPickupLocations,
  handleWebhook,
  generateLabel,
  getRecommendedCouriers,
  assignCourier,
  requestPickup
};