const { verifyWebhookSignature, getPaymentDetails } = require('../utils/razorpay');
const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const logger = require('../utils/logger');

// In-memory cache to prevent duplicate webhook processing (idempotency)
// In production, consider using Redis for distributed systems
const processedEvents = new Map();
const EVENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old events periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_CACHE_TTL) {
      processedEvents.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

/**
 * Find order by Razorpay order ID (searches both Order and CustomOrder)
 * @param {string} razorpayOrderId - Razorpay order ID
 * @returns {Promise<{order: Object, type: string}|null>}
 */
const findOrderByRazorpayId = async (razorpayOrderId) => {
  // Try regular orders first
  let order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
  if (order) return { order, type: 'regular' };

  // Try custom orders
  order = await CustomOrder.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
  if (order) return { order, type: 'custom' };

  return null;
};

/**
 * Emit real-time update via Socket.io
 * @param {Object} order - Order document
 * @param {string} eventType - Event type for the client
 * @param {Object} data - Additional data to send
 */
const emitOrderUpdate = (order, eventType, data = {}) => {
  try {
    const { io } = require('../index');
    if (io) {
      io.to(String(order._id)).emit(eventType, {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.payment?.status,
        ...data
      });
    }
  } catch (err) {
    logger.warn('Socket.io emit failed in payment webhook:', err.message);
  }
};

/**
 * Handle payment.captured event
 * @param {Object} payment - Payment entity from Razorpay
 */
const handlePaymentCaptured = async (payment) => {
  const razorpayOrderId = payment.order_id;
  
  const result = await findOrderByRazorpayId(razorpayOrderId);
  if (!result) {
    logger.warn('Order not found for captured payment:', { razorpayOrderId, paymentId: payment.id });
    return { success: false, message: 'Order not found' };
  }

  const { order, type } = result;

  // Idempotency: Skip if already paid
  if (order.payment?.status === 'paid') {
    logger.info('Payment already marked as paid, skipping:', { orderId: order._id, paymentId: payment.id });
    return { success: true, message: 'Already processed' };
  }

  // Update order payment status
  order.payment.razorpayPaymentId = payment.id;
  order.payment.status = 'paid';
  order.payment.paidAt = new Date(payment.created_at * 1000);
  order.status = 'confirmed';

  await order.save();

  logger.info('Payment captured and order confirmed:', {
    orderId: order._id,
    orderType: type,
    paymentId: payment.id,
    amount: payment.amount / 100
  });

  emitOrderUpdate(order, 'paymentSuccess', { paymentId: payment.id });

  return { success: true, message: 'Payment captured successfully' };
};

/**
 * Handle payment.authorized event (for manual capture flow)
 * @param {Object} payment - Payment entity from Razorpay
 */
const handlePaymentAuthorized = async (payment) => {
  const razorpayOrderId = payment.order_id;
  
  const result = await findOrderByRazorpayId(razorpayOrderId);
  if (!result) {
    logger.warn('Order not found for authorized payment:', { razorpayOrderId, paymentId: payment.id });
    return { success: false, message: 'Order not found' };
  }

  const { order, type } = result;

  // Update payment ID if not already set
  if (!order.payment.razorpayPaymentId) {
    order.payment.razorpayPaymentId = payment.id;
    await order.save();
  }

  logger.info('Payment authorized:', {
    orderId: order._id,
    orderType: type,
    paymentId: payment.id
  });

  return { success: true, message: 'Payment authorized' };
};

/**
 * Handle payment.failed event
 * @param {Object} payment - Payment entity from Razorpay
 */
const handlePaymentFailed = async (payment) => {
  const razorpayOrderId = payment.order_id;
  
  const result = await findOrderByRazorpayId(razorpayOrderId);
  if (!result) {
    logger.warn('Order not found for failed payment:', { razorpayOrderId, paymentId: payment.id });
    return { success: false, message: 'Order not found' };
  }

  const { order, type } = result;

  // Don't overwrite successful payment status
  if (order.payment?.status === 'paid') {
    logger.info('Ignoring payment.failed - order already paid:', { orderId: order._id });
    return { success: true, message: 'Order already paid, ignoring failure' };
  }

  order.payment.razorpayPaymentId = payment.id;
  order.payment.status = 'failed';
  order.notes = `Payment failed: ${payment.error_description || payment.error_reason || 'Unknown error'}`;

  await order.save();

  logger.warn('Payment failed:', {
    orderId: order._id,
    orderType: type,
    paymentId: payment.id,
    error: payment.error_description || payment.error_reason
  });

  emitOrderUpdate(order, 'paymentFailed', {
    paymentId: payment.id,
    error: payment.error_description || payment.error_reason
  });

  return { success: true, message: 'Payment failure recorded' };
};

/**
 * Handle refund.created event
 * @param {Object} refund - Refund entity from Razorpay
 * @param {Object} payment - Payment entity from Razorpay
 */
const handleRefundCreated = async (refund, payment) => {
  const paymentId = refund.payment_id || payment?.id;
  
  // Find order by payment ID
  let order = await Order.findOne({ 'payment.razorpayPaymentId': paymentId });
  let type = 'regular';
  
  if (!order) {
    order = await CustomOrder.findOne({ 'payment.razorpayPaymentId': paymentId });
    type = 'custom';
  }

  if (!order) {
    logger.warn('Order not found for refund:', { paymentId, refundId: refund.id });
    return { success: false, message: 'Order not found' };
  }

  // Update refund status
  order.refundAmount = (order.refundAmount || 0) + (refund.amount / 100);
  order.refundStatus = 'processing';

  await order.save();

  logger.info('Refund initiated:', {
    orderId: order._id,
    orderType: type,
    refundId: refund.id,
    amount: refund.amount / 100
  });

  emitOrderUpdate(order, 'refundInitiated', {
    refundId: refund.id,
    refundAmount: refund.amount / 100
  });

  return { success: true, message: 'Refund recorded' };
};

/**
 * Handle refund.processed event
 * @param {Object} refund - Refund entity from Razorpay
 */
const handleRefundProcessed = async (refund) => {
  const paymentId = refund.payment_id;
  
  let order = await Order.findOne({ 'payment.razorpayPaymentId': paymentId });
  let type = 'regular';
  
  if (!order) {
    order = await CustomOrder.findOne({ 'payment.razorpayPaymentId': paymentId });
    type = 'custom';
  }

  if (!order) {
    logger.warn('Order not found for processed refund:', { paymentId, refundId: refund.id });
    return { success: false, message: 'Order not found' };
  }

  // Check if full refund
  const totalRefunded = (order.refundAmount || 0);
  const orderTotal = type === 'custom' ? order.price : order.total;
  
  if (totalRefunded >= orderTotal) {
    order.refundStatus = 'completed';
    order.payment.status = 'refunded';
  } else {
    order.refundStatus = 'completed'; // Partial refund completed
  }

  await order.save();

  logger.info('Refund processed:', {
    orderId: order._id,
    orderType: type,
    refundId: refund.id,
    totalRefunded
  });

  emitOrderUpdate(order, 'refundCompleted', {
    refundId: refund.id,
    totalRefunded
  });

  return { success: true, message: 'Refund completed' };
};

/**
 * Handle refund.failed event
 * @param {Object} refund - Refund entity from Razorpay
 */
const handleRefundFailed = async (refund) => {
  const paymentId = refund.payment_id;
  
  let order = await Order.findOne({ 'payment.razorpayPaymentId': paymentId });
  let type = 'regular';
  
  if (!order) {
    order = await CustomOrder.findOne({ 'payment.razorpayPaymentId': paymentId });
    type = 'custom';
  }

  if (!order) {
    logger.warn('Order not found for failed refund:', { paymentId, refundId: refund.id });
    return { success: false, message: 'Order not found' };
  }

  order.refundStatus = 'failed';
  order.notes = `Refund failed: ${refund.failure_reason || 'Unknown reason'}`;

  await order.save();

  logger.error('Refund failed:', {
    orderId: order._id,
    orderType: type,
    refundId: refund.id,
    reason: refund.failure_reason
  });

  emitOrderUpdate(order, 'refundFailed', {
    refundId: refund.id,
    reason: refund.failure_reason
  });

  return { success: true, message: 'Refund failure recorded' };
};

/**
 * Handle order.paid event (alternative to payment.captured)
 * @param {Object} order - Order entity from Razorpay
 */
const handleOrderPaid = async (razorpayOrder) => {
  const razorpayOrderId = razorpayOrder.id;
  
  const result = await findOrderByRazorpayId(razorpayOrderId);
  if (!result) {
    logger.warn('Order not found for order.paid event:', { razorpayOrderId });
    return { success: false, message: 'Order not found' };
  }

  const { order, type } = result;

  if (order.payment?.status === 'paid') {
    logger.info('Order already paid, skipping order.paid event:', { orderId: order._id });
    return { success: true, message: 'Already processed' };
  }

  order.payment.status = 'paid';
  order.payment.paidAt = new Date();
  order.status = 'confirmed';

  await order.save();

  logger.info('Order marked as paid via order.paid event:', {
    orderId: order._id,
    orderType: type,
    razorpayOrderId
  });

  emitOrderUpdate(order, 'paymentSuccess');

  return { success: true, message: 'Order paid' };
};

/**
 * Main Razorpay webhook handler
 * POST /api/payment/webhook
 */
exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
    }

    const isValid = verifyWebhookSignature(req.body, signature);
    if (!isValid) {
      logger.warn('Invalid Razorpay webhook signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Parse the webhook payload
    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch (parseError) {
      logger.error('Failed to parse webhook payload:', parseError);
      return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }

    // Generate unique event key for idempotency
    const eventKey = `${event.event}-${event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id || event.payload?.order?.entity?.id || Date.now()}`;
    
    // Check for duplicate events
    if (processedEvents.has(eventKey)) {
      logger.info('Duplicate webhook event ignored:', { eventKey, eventType: event.event });
      return res.json({ success: true, message: 'Event already processed' });
    }

    // Mark event as being processed
    processedEvents.set(eventKey, Date.now());

    logger.info('Razorpay webhook received:', {
      event: event.event,
      eventKey,
      accountId: event.account_id
    });

    let result = { success: true, message: 'Event acknowledged' };

    // Route to appropriate handler based on event type
    switch (event.event) {
      case 'payment.captured':
        result = await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'payment.authorized':
        result = await handlePaymentAuthorized(event.payload.payment.entity);
        break;

      case 'payment.failed':
        result = await handlePaymentFailed(event.payload.payment.entity);
        break;

      case 'refund.created':
        result = await handleRefundCreated(
          event.payload.refund.entity,
          event.payload.payment?.entity
        );
        break;

      case 'refund.processed':
        result = await handleRefundProcessed(event.payload.refund.entity);
        break;

      case 'refund.failed':
        result = await handleRefundFailed(event.payload.refund.entity);
        break;

      case 'order.paid':
        result = await handleOrderPaid(event.payload.order.entity);
        break;

      default:
        logger.info('Unhandled Razorpay webhook event:', { event: event.event });
        result = { success: true, message: `Event ${event.event} acknowledged but not processed` };
    }

    return res.json(result);

  } catch (error) {
    logger.error('Razorpay webhook processing error:', {
      message: error.message,
      stack: error.stack
    });

    // Always return 200 to prevent Razorpay from retrying
    // Log the error for manual investigation
    return res.status(200).json({
      success: false,
      message: 'Error processing webhook, logged for review'
    });
  }
};

/**
 * Verify payment manually (for frontend verification)
 * POST /api/payment/verify
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId, orderType = 'regular' } = req.body;

    // Verify signature
    const { verifyPaymentSignature } = require('../utils/razorpay');
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      logger.warn('Manual payment verification failed:', { razorpayOrderId, razorpayPaymentId });
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Find and update order
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

    // Update order payment details
    order.payment.razorpayOrderId = razorpayOrderId;
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.status = 'confirmed';

    await order.save();

    logger.info('Payment verified manually:', {
      orderId: order._id,
      orderType,
      razorpayPaymentId
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.payment.status
      }
    });

  } catch (error) {
    logger.error('Payment verification error:', error);
    next(error);
  }
};

/**
 * Get payment status for an order
 * GET /api/payment/status/:orderId
 */
exports.getPaymentStatus = async (req, res, next) => {
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

    // If we have a Razorpay payment ID, fetch latest status
    let razorpayStatus = null;
    if (order.payment?.razorpayPaymentId) {
      try {
        const paymentDetails = await getPaymentDetails(order.payment.razorpayPaymentId);
        razorpayStatus = paymentDetails.status;
      } catch (err) {
        logger.warn('Could not fetch Razorpay payment status:', err.message);
      }
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        orderStatus: order.status,
        paymentStatus: order.payment?.status || 'pending',
        razorpayStatus,
        razorpayOrderId: order.payment?.razorpayOrderId,
        razorpayPaymentId: order.payment?.razorpayPaymentId,
        paidAt: order.payment?.paidAt,
        refundStatus: order.refundStatus,
        refundAmount: order.refundAmount
      }
    });

  } catch (error) {
    logger.error('Get payment status error:', error);
    next(error);
  }
};

// Export all functions
module.exports = {
  razorpayWebhook: exports.razorpayWebhook,
  verifyPayment: exports.verifyPayment,
  getPaymentStatus: exports.getPaymentStatus
};
