const crypto = require('crypto');

// Generate a secure webhook token
function generateWebhookToken() {
  return crypto.randomBytes(32).toString('hex');
}

const webhookToken = generateWebhookToken();

console.log('🔐 Generated Webhook Token:');
console.log('================================');
console.log(webhookToken);
console.log('');
console.log('Add this to your .env file:');
console.log(`DELHIVERY_WEBHOOK_TOKEN=${webhookToken}`);
console.log('');
console.log('Use this same token in Delhivery webhook configuration');
