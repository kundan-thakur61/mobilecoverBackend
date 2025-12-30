const { verifyWebhookSignature } = require('../utils/razorpay');

exports.razorpayWebhook = (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  const isValid = verifyWebhookSignature(req.body, signature);
  if (!isValid) {
    return res.status(400).json({ success: false });
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    console.log('Payment captured:', payment.id);
    // yahan order PAID karo
  }

  res.json({ success: true });
};
