/**
 * Controller for handling Shiprocket Webhooks.
 * 
 * Setup:
 * 1. Define SHIPROCKET_WEBHOOK_TOKEN in your .env file.
 * 2. Configure the same token in the Shiprocket Webhook settings under 'x-api-key'.
 */
const handleShiprocketWebhook = (req, res) => {
  try {
    const receivedToken = req.headers['x-api-key'];
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;

    // Validate the token sent by Shiprocket
    if (!receivedToken || receivedToken !== expectedToken) {
      console.warn(`[Shiprocket Webhook] Invalid token received: ${receivedToken}`);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body;
    console.log('[Shiprocket Webhook] Event received:', JSON.stringify(payload, null, 2));

    // TODO: Add logic to handle specific events (e.g., order status updates)
    // Example: if (payload.current_status === 'DELIVERED') { ... }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('[Shiprocket Webhook] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = { handleShiprocketWebhook };