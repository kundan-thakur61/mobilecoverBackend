const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const Product = require('../models/Product');
const { verifyWebhookSignature, capturePayment } = require('../utils/razorpay');
const logger = require('../utils/logger');

/**
 * Handle Razorpay webhooks
 * POST /api/webhooks/razorpay
 */
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const isSignatureValid = verifyWebhookSignature(body, signature);
    
    if (!isSignatureValid) {
      logger.error('Invalid webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const { event, payload } = req.body;
    logger.info('Razorpay webhook received:', { event });

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      
      case 'refund.created':
        await handleRefundCreated(payload);
        break;
      
      case 'refund.failed':
        await handleRefundFailed(payload);
        break;
      
      default:
        logger.info('Unhandled webhook event:', event);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * Handle payment captured webhook
 */
const handlePaymentCaptured = async (payload) => {
  try {
    const { payment } = payload;
    const { order_id: razorpayOrderId } = payment;

    // Try to find regular order first
    let order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
    
    if (order) {
      // Update regular order
      order.payment.razorpayPaymentId = payment.id;
      order.payment.status = 'paid';
      order.payment.paidAt = new Date();
      order.status = 'confirmed';
      
      await order.save();

      // Update product stock
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        const variant = product.variants.id(item.variantId);
        variant.stock -= item.quantity;
        await product.save();
      }

      logger.info('Regular order payment captured:', {
        orderId: order._id,
        paymentId: payment.id
      });
    } else {
      // Try to find custom order
      let customOrder = await CustomOrder.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
      
      if (customOrder) {
        customOrder.payment.razorpayPaymentId = payment.id;
        customOrder.payment.status = 'paid';
        customOrder.payment.paidAt = new Date();
        
        await customOrder.save();

        logger.info('Custom order payment captured:', {
          customOrderId: customOrder._id,
          paymentId: payment.id
        });
      } else {
        logger.warn('Payment captured but no matching order found:', {
          razorpayOrderId
        });
      }
    }
  } catch (error) {
    logger.error('Error handling payment captured webhook:', error);
    throw error;
  }
};

/**
 * Handle payment failed webhook
 */
const handlePaymentFailed = async (payload) => {
  try {
    const { payment } = payload;
    const { order_id: razorpayOrderId, error_code, error_description } = payment;

    // Try to find regular order
    let order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
    
    if (order) {
      order.payment.status = 'failed';
      order.status = 'cancelled';
      order.cancellationReason = `Payment failed: ${error_description || error_code}`;
      
      await order.save();

      logger.info('Regular order payment failed:', {
        orderId: order._id,
        error: error_description || error_code
      });
    } else {
      // Try to find custom order
      let customOrder = await CustomOrder.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
      
      if (customOrder) {
        customOrder.payment.status = 'failed';
        
        await customOrder.save();

        logger.info('Custom order payment failed:', {
          customOrderId: customOrder._id,
          error: error_description || error_code
        });
      } else {
        logger.warn('Payment failed but no matching order found:', {
          razorpayOrderId
        });
      }
    }
  } catch (error) {
    logger.error('Error handling payment failed webhook:', error);
    throw error;
  }
};

/**
 * Handle refund created webhook
 */
const handleRefundCreated = async (payload) => {
  try {
    const { refund } = payload;
    const { payment_id: paymentId } = refund;

    // Find order by payment ID
    let order = await Order.findOne({ 'payment.razorpayPaymentId': paymentId });
    
    if (order) {
      order.refundStatus = 'processing';
      order.refundAmount = refund.amount / 100; // Convert from paise
      
      await order.save();

      logger.info('Refund created for regular order:', {
        orderId: order._id,
        refundId: refund.id
      });
    } else {
      // Try custom order
      let customOrder = await CustomOrder.findOne({ 'payment.razorpayPaymentId': paymentId });
      
      if (customOrder) {
        customOrder.refundStatus = 'processing';
        customOrder.refundAmount = refund.amount / 100;
        
        await customOrder.save();

        logger.info('Refund created for custom order:', {
          customOrderId: customOrder._id,
          refundId: refund.id
        });
      }
    }
  } catch (error) {
    logger.error('Error handling refund created webhook:', error);
    throw error;
  }
};

/**
 * Handle refund failed webhook
 */
const handleRefundFailed = async (payload) => {
  try {
    const { refund } = payload;
    const { payment_id: paymentId } = refund;

    // Find order by payment ID
    let order = await Order.findOne({ 'payment.razorpayPaymentId': paymentId });
    
    if (order) {
      order.refundStatus = 'failed';
      order.notes = `Refund failed: ${refund.error_description || 'Unknown error'}`;
      
      await order.save();

      logger.error('Refund failed for regular order:', {
        orderId: order._id,
        refundId: refund.id,
        error: refund.error_description
      });
    } else {
      // Try custom order
      let customOrder = await CustomOrder.findOne({ 'payment.razorpayPaymentId': paymentId });
      
      if (customOrder) {
        customOrder.refundStatus = 'failed';
        
        await customOrder.save();

        logger.error('Refund failed for custom order:', {
          customOrderId: customOrder._id,
          refundId: refund.id,
          error: refund.error_description
        });
      }
    }
  } catch (error) {
    logger.error('Error handling refund failed webhook:', error);
    throw error;
  }
};

/**
 * Handle order paid webhook (alternative to payment.captured)
 * This can be used if you want to handle successful payments differently
 */
const handleOrderPaid = async (payload) => {
  try {
    const { order } = payload;
    const { id: razorpayOrderId } = order;

    // Update order status
    const dbOrder = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
    
    if (dbOrder && dbOrder.payment.status !== 'paid') {
      dbOrder.payment.status = 'paid';
      dbOrder.payment.paidAt = new Date();
      dbOrder.status = 'confirmed';
      
      await dbOrder.save();

      // Update stock
      for (const item of dbOrder.items) {
        const product = await Product.findById(item.productId);
        const variant = product.variants.id(item.variantId);
        variant.stock -= item.quantity;
        await product.save();
      }

      logger.info('Order marked as paid via webhook:', {
        orderId: dbOrder._id,
        razorpayOrderId
      });
    }
  } catch (error) {
    logger.error('Error handling order paid webhook:', error);
    throw error;
  }
};

const handleShiprocketWebhook = async (req, res, next) => {
  try {
    const token = req.headers['x-api-key'];
    const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;

    if (token !== webhookSecret) {
      logger.error('Invalid Shiprocket webhook token');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const payload = req.body;
    logger.info('Shiprocket webhook received:', { 
      event: payload.shipment_status || payload.status,
      shipmentId: payload.shipment_id || payload.id
    });

    await handleShiprocketStatusUpdate(payload);

    res.json({ success: true });
  } catch (error) {
    logger.error('Shiprocket webhook error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const handleShiprocketStatusUpdate = async (payload) => {
  try {
    const shipmentId = payload.shipment_id || payload.id;
    const awbCode = payload.awb_code || payload.awb;
    const status = payload.shipment_status || payload.status;
    const currentStatus = payload.current_status || payload.shipment_status;
    
    let order;
    
    if (shipmentId) {
      order = await Order.findOne({ 'shiprocket.shipmentId': shipmentId });
    } else if (awbCode) {
      order = await Order.findOne({ 'shiprocket.awbCode': awbCode });
    }

    if (!order) {
      logger.warn('Shiprocket webhook: Order not found', { shipmentId, awbCode });
      return;
    }

    order.shiprocket.status = status;
    order.shiprocket.lastSyncedAt = new Date();

    if (payload.current_status) {
      order.shiprocket.trackingData.currentStatus = payload.current_status;
    }

    if (payload.shipment_status) {
      order.shiprocket.trackingData.shipmentStatus = payload.shipment_status;
    }

    if (payload.pickup_date) {
      order.shiprocket.trackingData.pickupDate = new Date(payload.pickup_date);
    }

    if (payload.delivered_date) {
      order.shiprocket.trackingData.deliveryDate = new Date(payload.delivered_date);
    }

    const statusLower = (status || currentStatus || '').toLowerCase();
    
    if (statusLower.includes('delivered')) {
      order.status = 'delivered';
    } else if (statusLower.includes('shipped') || statusLower.includes('in transit') || statusLower.includes('out for delivery')) {
      order.status = 'shipped';
    } else if (statusLower.includes('rto') || statusLower.includes('return')) {
      order.shiprocket.rtoReason = payload.rto_reason || 'Return initiated';
    } else if (statusLower.includes('cancelled')) {
      order.status = 'cancelled';
      order.cancellationReason = payload.reason || 'Cancelled by courier';
    }

    if (payload.activities && Array.isArray(payload.activities)) {
      order.shiprocket.trackingData.shipmentTrack = payload.activities.map(activity => ({
        status: activity.status || activity.activity,
        date: activity.date ? new Date(activity.date) : new Date(),
        location: activity.location || '',
        activity: activity.activity || activity.status || ''
      }));
    }

    await order.save();

    logger.info('Order updated from Shiprocket webhook:', {
      orderId: order._id,
      shipmentId,
      status: order.status,
      shiprocketStatus: order.shiprocket.status
    });
  } catch (error) {
    logger.error('Error handling Shiprocket status update:', error);
    throw error;
  }
};

module.exports = {
  handleRazorpayWebhook,
  handleShiprocketWebhook
};