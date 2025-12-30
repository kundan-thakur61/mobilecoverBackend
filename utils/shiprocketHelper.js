const shiprocketService = require('./shiprocket');
const logger = require('./logger');

/**
 * Shiprocket Order Helper
 * 
 * This utility helps automatically create shipments in Shiprocket
 * when orders are confirmed and paid.
 */

/**
 * Prepare order items for Shiprocket format
 * @param {Array} items - Order items
 * @param {String} orderType - 'regular' or 'custom'
 * @returns {Array} Formatted items for Shiprocket
 */
const prepareOrderItems = (items, orderType = 'regular') => {
  if (orderType === 'custom') {
    return items.map(item => ({
      name: item.title || 'Custom Mobile Cover',
      sku: item.sku || `CUSTOM-${Date.now()}`,
      units: item.quantity || 1,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: 392690 // HSN code for plastic articles
    }));
  }

  return items.map(item => ({
    name: item.title || 'Mobile Cover',
    sku: item.variantId?.toString() || 'SKU-NA',
    units: item.quantity,
    selling_price: item.price,
    discount: 0,
    tax: 0,
    hsn: 392690
  }));
};

/**
 * Split full name into first and last name
 * @param {String} fullName - Full customer name
 * @returns {Object} { firstName, lastName }
 */
const splitName = (fullName) => {
  const trimmedName = (fullName || 'Customer').trim();
  const parts = trimmedName.split(' ');
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || ''
  };
};

/**
 * Get default dimensions based on order type
 * @param {String} orderType - 'regular' or 'custom'
 * @param {Number} quantity - Number of items
 * @returns {Object} { length, breadth, height, weight }
 */
const getDefaultDimensions = (orderType = 'regular', quantity = 1) => {
  // Mobile covers are typically small and light
  const baseWeight = 0.15; // kg per cover
  
  return {
    length: 15,
    breadth: 10,
    height: Math.max(2, Math.ceil(quantity * 0.5)), // Stack height
    weight: Math.max(0.1, baseWeight * quantity)
  };
};

/**
 * Auto-create shipment for an order
 * This function is called after payment verification
 * 
 * @param {Object} order - Mongoose order document
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Shiprocket response or null if failed
 */
const autoCreateShipment = async (order, options = {}) => {
  try {
    const {
      orderType = 'regular',
      pickupLocation = 'Primary',
      autoAssignCourier = true,
      requestPickup = false,
      dimensions = null,
      weight = null
    } = options;

    // Check if shipment already exists
    if (order.shiprocket?.shipmentId) {
      logger.info('Shipment already exists for order:', order._id);
      return { alreadyExists: true, shipmentId: order.shiprocket.shipmentId };
    }

    // Check if order is paid or COD
    const isCOD = order.payment?.method === 'cod';
    const isPaid = order.payment?.status === 'paid';
    
    if (!isCOD && !isPaid) {
      logger.warn('Cannot create shipment for unpaid non-COD order:', order._id);
      return null;
    }

    // Prepare shipping address
    const shippingAddr = order.shippingAddress;
    if (!shippingAddr || !shippingAddr.postalCode || !shippingAddr.city) {
      logger.error('Invalid shipping address for order:', order._id);
      return null;
    }

    // Split customer name
    const { firstName, lastName } = splitName(shippingAddr.name);

    // Get user details
    const email = order.userId?.email || shippingAddr.email || 'customer@example.com';
    const phone = shippingAddr.phone || '0000000000';

    // Prepare order items
    const orderItems = orderType === 'custom' 
      ? prepareOrderItems([{
          title: `Custom ${order.designData?.modelName || 'Mobile Cover'}`,
          sku: order.variant?.sku || `CUSTOM-${order._id}`,
          quantity: order.quantity || 1,
          price: order.price
        }], 'custom')
      : prepareOrderItems(order.items, 'regular');

    // Get dimensions
    const dims = dimensions || getDefaultDimensions(
      orderType,
      orderType === 'custom' ? (order.quantity || 1) : order.items.reduce((sum, i) => sum + i.quantity, 0)
    );

    // Prepare Shiprocket order data
    const shiprocketOrderData = {
      orderId: orderType === 'custom' ? `CUST-${order._id}` : `ORD-${order._id}`,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupLocation: pickupLocation,
      billingCustomerName: firstName,
      billingLastName: lastName,
      billingAddress: shippingAddr.address1 || shippingAddr.street,
      billingAddress2: shippingAddr.address2 || '',
      billingCity: shippingAddr.city,
      billingPincode: shippingAddr.postalCode || shippingAddr.zipCode,
      billingState: shippingAddr.state,
      billingCountry: shippingAddr.country || 'India',
      billingEmail: email,
      billingPhone: phone,
      shippingIsBilling: true,
      orderItems: orderItems,
      paymentMethod: isCOD ? 'COD' : 'Prepaid',
      subTotal: orderType === 'custom' ? order.price : order.total,
      length: dims.length,
      breadth: dims.breadth,
      height: dims.height,
      weight: weight || dims.weight
    };

    logger.info('Creating Shiprocket shipment for order:', {
      orderId: order._id,
      orderType,
      shiprocketOrderId: shiprocketOrderData.orderId
    });

    // Create shipment in Shiprocket
    const shiprocketResponse = await shiprocketService.createOrder(shiprocketOrderData);

    if (!shiprocketResponse || !shiprocketResponse.shipment_id) {
      logger.error('Invalid Shiprocket response:', shiprocketResponse);
      return null;
    }

    // Update order with Shiprocket details
    order.shiprocket = {
      shipmentId: shiprocketResponse.shipment_id,
      orderId: shiprocketResponse.order_id,
      status: shiprocketResponse.status,
      statusCode: shiprocketResponse.status_code,
      lastSyncedAt: new Date()
    };

    // Auto-assign courier if enabled
    if (autoAssignCourier) {
      try {
        const couriers = await shiprocketService.getRecommendedCouriers(shiprocketResponse.shipment_id);
        
        if (couriers && couriers.length > 0) {
          // Sort by freight charge (cheapest first)
          const sortedCouriers = couriers.sort((a, b) => 
            (a.freight_charge || 999) - (b.freight_charge || 999)
          );
          
          const selectedCourier = sortedCouriers[0];
          
          logger.info('Auto-assigning courier:', {
            orderId: order._id,
            courierId: selectedCourier.courier_company_id,
            courierName: selectedCourier.courier_name,
            freight: selectedCourier.freight_charge
          });

          // Assign courier and generate AWB
          const awbResponse = await shiprocketService.assignCourier(
            shiprocketResponse.shipment_id,
            selectedCourier.courier_company_id
          );

          if (awbResponse && awbResponse.awb_code) {
            order.shiprocket.awbCode = awbResponse.awb_code;
            order.shiprocket.courierId = selectedCourier.courier_company_id;
            order.shiprocket.courierName = awbResponse.courier_name || selectedCourier.courier_name;
            order.trackingNumber = awbResponse.awb_code;
            
            logger.info('AWB generated:', {
              orderId: order._id,
              awbCode: awbResponse.awb_code
            });

            // Request pickup if enabled
            if (requestPickup) {
              try {
                await shiprocketService.requestPickup(shiprocketResponse.shipment_id);
                order.shiprocket.pickupScheduledDate = new Date();
                logger.info('Pickup requested for order:', order._id);
              } catch (pickupError) {
                logger.error('Failed to request pickup:', {
                  orderId: order._id,
                  error: pickupError.message
                });
              }
            }
          }
        } else {
          logger.warn('No couriers available for order:', order._id);
        }
      } catch (courierError) {
        logger.error('Failed to auto-assign courier:', {
          orderId: order._id,
          error: courierError.message
        });
      }
    }

    // Save updated order
    await order.save();

    logger.info('Shiprocket shipment created successfully:', {
      orderId: order._id,
      shipmentId: shiprocketResponse.shipment_id,
      awbCode: order.shiprocket.awbCode
    });

    return {
      success: true,
      shipmentId: shiprocketResponse.shipment_id,
      orderId: shiprocketResponse.order_id,
      awbCode: order.shiprocket.awbCode,
      courierName: order.shiprocket.courierName
    };

  } catch (error) {
    logger.error('Failed to auto-create Shiprocket shipment:', {
      orderId: order._id,
      error: error.message,
      stack: error.stack
    });
    
    // Don't throw - we don't want to fail the order if Shiprocket fails
    return null;
  }
};

/**
 * Sync tracking information for an order
 * @param {Object} order - Mongoose order document
 * @returns {Promise<Boolean>} Success status
 */
const syncTrackingInfo = async (order) => {
  try {
    if (!order.shiprocket?.awbCode) {
      return false;
    }

    const trackingData = await shiprocketService.trackShipment(
      order.shiprocket.awbCode,
      'awb'
    );

    if (trackingData && trackingData.tracking_data) {
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

      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to sync tracking info:', {
      orderId: order._id,
      error: error.message
    });
    return false;
  }
};

module.exports = {
  autoCreateShipment,
  syncTrackingInfo,
  prepareOrderItems,
  splitName,
  getDefaultDimensions
};
