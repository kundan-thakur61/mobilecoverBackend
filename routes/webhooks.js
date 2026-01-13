const express = require('express');
const router = express.Router();

const { handleRazorpayWebhook } = require('../controllers/webhookController');
const { handleWebhook } = require('../controllers/shiprocketController');

router.post('/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

router.post('/shiprocket', handleWebhook);

module.exports = router;
