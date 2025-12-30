const express = require('express');
const router = express.Router();

const { handleRazorpayWebhook, handleShiprocketWebhook } = require('../controllers/webhookController');

router.post('/razorpay', 
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

router.post('/shiprocket', handleShiprocketWebhook);

module.exports = router;