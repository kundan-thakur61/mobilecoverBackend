const express = require('express');
const router = express.Router();
const { razorpayWebhook } = require('../controllers/paymentController');

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  razorpayWebhook
);

module.exports = router;
