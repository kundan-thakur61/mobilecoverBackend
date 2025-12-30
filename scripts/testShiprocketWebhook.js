const axios = require('axios');

const WEBHOOK_URL = process.env.WEBHOOK_BASE_URL 
  ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/shiprocket`
  : 'http://localhost:4000/api/webhooks/shiprocket';

const WEBHOOK_SECRET = process.env.SHIPROCKET_WEBHOOK_SECRET || 'your-secret-shnfhhuiprocket-webhooijook-token-12345';

const testPayloads = {
  shipped: {
    shipment_id: 123456,
    awb_code: 'AWB123456789',
    shipment_status: 'SHIPPED',
    current_status: 'In Transit',
    courier_name: 'BlueDart',
    pickup_date: new Date().toISOString(),
    expected_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    activities: [
      {
        status: 'Picked Up',
        date: new Date().toISOString(),
        location: 'Mumbai Hub',
        activity: 'Shipment picked up from seller'
      },
      {
        status: 'In Transit',
        date: new Date().toISOString(),
        location: 'Mumbai Sorting Center',
        activity: 'Package is in transit'
      }
    ]
  },
  delivered: {
    shipment_id: 123456,
    awb_code: 'AWB123456789',
    shipment_status: 'DELIVERED',
    current_status: 'Delivered',
    courier_name: 'BlueDart',
    delivered_date: new Date().toISOString(),
    activities: [
      {
        status: 'Delivered',
        date: new Date().toISOString(),
        location: 'Delhi',
        activity: 'Package delivered successfully'
      }
    ]
  },
  outForDelivery: {
    shipment_id: 123456,
    awb_code: 'AWB123456789',
    shipment_status: 'OUT_FOR_DELIVERY',
    current_status: 'Out for Delivery',
    courier_name: 'BlueDart',
    activities: [
      {
        status: 'Out for Delivery',
        date: new Date().toISOString(),
        location: 'Delhi Hub',
        activity: 'Package out for delivery'
      }
    ]
  }
};

async function testWebhook(payloadType = 'shipped') {
  try {
    console.log(`\n🧪 Testing Shiprocket Webhook: ${payloadType.toUpperCase()}`);
    console.log('━'.repeat(50));
    console.log(`URL: ${WEBHOOK_URL}`);
    console.log(`Payload Type: ${payloadType}`);
    console.log('━'.repeat(50));

    const payload = testPayloads[payloadType];
    
    if (!payload) {
      console.error(`❌ Invalid payload type: ${payloadType}`);
      console.log(`Available types: ${Object.keys(testPayloads).join(', ')}`);
      return;
    }

    console.log('\n📦 Payload:');
    console.log(JSON.stringify(payload, null, 2));

    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WEBHOOK_SECRET
      }
    });

    console.log('\n✅ Response:');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

const payloadType = process.argv[2] || 'shipped';
testWebhook(payloadType);
