const express = require('express');
const router = express.Router();
const { razorpayWebhook, verifyPayment, getPaymentStatus } = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');

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
 * @access  Private (requires auth)
 */
router.post('/verify', authMiddleware, verifyPayment);

/**
 * @route   GET /api/payment/status/:orderId
 * @desc    Get payment status for an order
 * @access  Private (requires auth)
 */
router.get('/status/:orderId', authMiddleware, getPaymentStatus);

module.exports = router;
