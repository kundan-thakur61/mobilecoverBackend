/**
 * Controller for handling DeliveryOne Webhooks.
 * 
 * Setup:
 * 1. Define DELIVERYONE_WEBHOOK_TOKEN in your .env file.
 * 2. Configure the same token in the DeliveryOne Webhook settings under 'x-api-key'.
 */
const handleDeliveryOneWebhook = (req, res) => {
  try {
    const receivedToken = req.headers['x-api-key'];
    const expectedToken = process.env.DELIVERYONE_WEBHOOK_TOKEN;

    // Validate the token sent by DeliveryOne
    if (!receivedToken || receivedToken !== expectedToken) {
      console.warn(`[DeliveryOne Webhook] Invalid token received: ${receivedToken}`);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body;
    console.log('[DeliveryOne Webhook] Event received:', JSON.stringify(payload, null, 2));

    // TODO: Add logic to handle specific events (e.g., order status updates)
    // Example: if (payload.current_status === 'DELIVERED') { ... }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('[DeliveryOne Webhook] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = { handleDeliveryOneWebhook };