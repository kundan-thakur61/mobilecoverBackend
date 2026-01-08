const express = require('express');
const router = express.Router();

const { handleRazorpayWebhook, handleDeliveryOneWebhook } = require('../controllers/webhookController');

router.post('/razorpay', 
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

router.post('/deliveryone', handleDeliveryOneWebhook);

module.exports = router;