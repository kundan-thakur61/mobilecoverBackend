const http = require('http');
const crypto = require('crypto');

const payload = JSON.stringify({ order_id: 'test', current_status: 'delivered' });
const secret = process.env.SHIPROCKET_WEBHOOK_SECRET || 'testsecret';
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 5001,
  path: '/api/logistics/logistics-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'x-shiprocket-signature': signature
  }
};

const req = http.request(options, (res) => {
  console.log('status', res.statusCode);
  res.setEncoding('utf8');
  res.on('data', (d) => console.log('body', d));
});

req.on('error', (e) => console.error('request error', e));
req.write(payload);
req.end();

/* Usage:
   Set environment: SHIPROCKET_WEBHOOK_SECRET and PORT if needed, then run:
   node testWebhook.js
*/
