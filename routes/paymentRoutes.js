const express = require('express');
const router = express.Router();
const { razorpayWebhook, verifyPayment, getPaymentStatus } = require('../controllers/paymentController');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/payment/webhook
 * @desc    Razorpay webhook endpoint (handles payment events)
 * @access  Public (verified via signature)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  razorpayWebhook
);

/**
 * @route   POST /api/payment/verify
 * @desc    Verify payment signature after checkout
 * @access  Public (uses optional auth)
 */
router.post('/verify', optionalAuth, verifyPayment);

/**
 * @route   GET /api/payment/status/:orderId
 * @desc    Get payment status for an order
 * @access  Private (requires auth)
 */
router.get('/status/:orderId', optionalAuth, getPaymentStatus);

module.exports = router;
