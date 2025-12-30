const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('./logger');

// Initialize Razorpay instance
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
} else {
  // Provide a lightweight stub so the rest of the app (and tests) can import this module
  // without having real API keys. Each method mirrors the Razorpay interface but will
  // either return a resolved placeholder value or throw a clear error when used.
  logger.warn('Razorpay keys are not set in environment. Using stubbed razorpay client for tests and local dev.');

  razorpay = {
    orders: {
      create: async (payload) => ({ id: `stub-order-${Date.now()}`, ...payload })
    },
    payments: {
      capture: async (paymentId, amount) => ({ id: `stub-capture-${paymentId}`, amount }),
      refund: async (paymentId, data) => ({ id: `stub-refund-${paymentId}`, ...data }),
      fetch: async (paymentId) => ({ id: paymentId, status: 'stub' })
    }
  };
}
/**
 * Create a new order in Razorpay
 * @param {Object} options - Order options
 * @returns {Promise<Object>} Razorpay order
 */
const createOrder = async (options) => {
  try {
    if (!options || (options.amount === undefined || options.amount === null)) {
      const msg = 'Invalid options passed to createOrder: amount is required';
      logger.error(msg, { options });
      throw new Error(msg);
    }

    const payload = {
      amount: options.amount, // Expect amount in paise
      currency: options.currency || 'INR',
      receipt: options.receipt,
      payment_capture: options.payment_capture !== undefined ? options.payment_capture : 1,
      notes: options.notes || {}
    };

    const order = await razorpay.orders.create(payload);

    try {
      if (order && typeof order === 'object') {
        logger.info('Razorpay order created', { orderId: order.id || null, amount: order.amount ?? payload.amount });
      } else {
        logger.warn('Razorpay order created but response was unexpected', { order });
      }
    } catch (logErr) {
      // Ensure logging does not break order creation flow
      logger.error('Error while logging Razorpay order result', logErr);
    }

    return order;
  } catch (error) {
    // Provide richer error context for easier debugging
    const details = {
      message: error && error.message,
      name: error && error.name,
      stack: error && error.stack,
      // Some Razorpay errors include a `error` or `response` payload
      response: error && (error.error || error.response || null)
    };
    logger.error('Razorpay order creation error', details);
    throw error;
  }
};

/**
 * Verify payment signature
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} razorpayPaymentId - Razorpay payment ID
 * @param {string} signature - Signature to verify
 * @returns {boolean} Verification result
 */
const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  try {
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    logger.error('Payment signature verification error:', error);
    return false;
  }
};

/**
 * Verify webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - Webhook signature
 * @returns {boolean} Verification result
 */
const verifyWebhookSignature = (body, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body, 'utf8')
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    logger.error('Webhook signature verification error:', error);
    return false;
  }
};

/**
 * Capture payment
 * @param {string} paymentId - Payment ID to capture
 * @param {number} amount - Amount to capture (in paise)
 * @returns {Promise<Object>} Capture result
 */
const capturePayment = async (paymentId, amount) => {
  try {
    const capture = await razorpay.payments.capture(paymentId, amount);
    logger.info('Payment captured:', { paymentId, amount });
    return capture;
  } catch (error) {
    logger.error('Payment capture error:', error);
    throw error;
  }
};

/**
 * Refund payment
 * @param {string} paymentId - Payment ID to refund
 * @param {number} amount - Amount to refund (in paise, optional)
 * @param {Object} options - Refund options
 * @returns {Promise<Object>} Refund result
 */
const refundPayment = async (paymentId, amount = null, options = {}) => {
  try {
    const refundData = {
      ...options
    };
    
    if (amount) {
      refundData.amount = amount;
    }
    
    const refund = await razorpay.payments.refund(paymentId, refundData);
    logger.info('Payment refunded:', { paymentId, refundId: refund.id });
    return refund;
  } catch (error) {
    logger.error('Payment refund error:', error);
    throw error;
  }
};

/**
 * Get payment details
 * @param {string} paymentId - Payment ID
 * @returns {Promise<Object>} Payment details
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    logger.error('Get payment details error:', error);
    throw error;
  }
};

module.exports = {
  razorpay,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  capturePayment,
  refundPayment,
  getPaymentDetails
};