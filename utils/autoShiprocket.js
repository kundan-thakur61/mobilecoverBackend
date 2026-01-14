const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const shiprocketService = require('./shiprocket');
const logger = require('./logger');

/**
 * Automatically create order in Shiprocket when an order is placed
 * @param {string} orderId - MongoDB order ID
 * @param {string} orderType - Type of order ('regular' or 'custom')
 * @returns {Promise<Object>} Result of order creation
 */
const createAutoShipment = async (orderId, orderType = 'regular') => {
  try {
    logger.info('🚚 [AutoShipment] Starting automatic shipment creation:', {
      orderId,
      orderType
    });

    // Get order details based on type
    let order;
    if (orderType === 'custom') {
      order = await CustomOrder.findById(orderId).populate('userId');
    } else {
      order = await Order.findById(orderId).populate('userId');
    }

    if (!order) {
      logger.error('❌ [AutoShipment] Order not found:', { orderId, orderType });
      return { success: false, message: 'Order not found' };
    }

    // Check if shipment already exists
    if (order.shiprocket?.shipmentId || order.shiprocket?.awbCode) {
      logger.warn('⚠️ [AutoShipment] Shipment already exists for order:', {
        orderId,
        shipmentId: order.shiprocket.shipmentId,
        awbCode: order.shiprocket.awbCode
      });
      return {
        success: true,
        message: 'Shipment already exists',
        data: {
          shipmentId: order.shiprocket.shipmentId,
          awbCode: order.shiprocket.awbCode
        }
      };
    }

    // Prepare order items for Shiprocket
    let orderItems;
    if (orderType === 'custom') {
      const rawSku = order.variant?.sku || `CUSTOM-${orderId}`;
      let sku = String(rawSku).trim();
      
      // Shiprocket SKU limit
      if (sku.length > 50) {
        logger.info(`[AutoShipment] Truncating Custom SKU from ${sku.length} chars to 40 chars`);
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
          logger.info(`[AutoShipment] Truncating SKU from ${sku.length} chars`);
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

    // Prepare Shiprocket order data
    const shiprocketOrderData = {
      orderId: orderType === 'custom' ? `CUST-${orderId}` : `ORD-${orderId}`,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupLocationId: '1', // Default to first pickup location
      billingCustomerName: firstName,
      billingAddress: order.shippingAddress?.address1 || order.shippingAddress?.street,
      billingCity: order.shippingAddress?.city,
      billingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      billingState: order.shippingAddress?.state,
      billingCountry: order.shippingAddress?.country || 'India',
      billingEmail: email,
      billingPhone: phone,
      shippingCustomerName: firstName,
      shippingAddress: order.shippingAddress?.address1 || order.shippingAddress?.street,
      shippingCity: order.shippingAddress?.city,
      shippingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      shippingState: order.shippingAddress?.state,
      shippingCountry: order.shippingAddress?.country || 'India',
      shippingEmail: email,
      shippingPhone: phone,
      orderItems: orderItems,
      paymentMethod: order.payment?.method === 'cod' ? 'cod' : 'prepaid',
      subTotal: orderType === 'custom' ? order.price : order.total,
      length: 15, // Default dimensions
      breadth: 10,
      height: 2,
      weight: 0.15 // Default weight in kg
    };

    logger.info('[AutoShipment] Sending Order Data to Shiprocket:', {
      orderId: shiprocketOrderData.orderId,
      customer: shiprocketOrderData.shippingCustomerName,
      city: shiprocketOrderData.shippingCity,
      pincode: shiprocketOrderData.shippingPincode
    });

    // Create order in Shiprocket
    const shiprocketResponse = await shiprocketService.createOrder(shiprocketOrderData);

    if (!shiprocketResponse.success) {
      throw new Error(shiprocketResponse.message || 'Failed to create shipment in Shiprocket');
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

    logger.info('✅ [AutoShipment] Automatic shipment created and saved:', {
      orderId,
      orderType,
      shipmentId: shiprocketResponse.shipmentId,
      awbCode: shiprocketResponse.awbCode
    });

    return {
      success: true,
      message: 'Automatic shipment created successfully',
      data: {
        shipmentId: shiprocketResponse.shipmentId,
        awbCode: shiprocketResponse.awbCode,
        orderId: shiprocketResponse.orderId,
        status: shiprocketResponse.status,
        trackingUrl: shiprocketResponse.trackingUrl || `https://shiprocket.co/tracking/${shiprocketResponse.awbCode}`
      }
    };
  } catch (error) {
    logger.error('❌ [AutoShipment] Failed to create automatic shipment:', {
      error: error.message,
      stack: error.stack,
      orderId,
      orderType
    });
    
    // Return success: false but don't throw to prevent breaking the order confirmation flow
    return {
      success: false,
      message: `Failed to create automatic shipment: ${error.message}`
    };
  }
};

module.exports = {
  createAutoShipment
};