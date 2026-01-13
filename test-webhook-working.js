require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.use(express.json());

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob')
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ DB connection failed:', err));

// Import webhook controller directly
const { handleWebhook } = require('./controllers/deliveryOneController');

// Add webhook route
app.post('/api/deliveryone/webhook', handleWebhook);
app.post('/api/webhooks/delhivery', handleWebhook);

app.listen(4002, () => {
  console.log('🔧 Webhook test server running on port 4002');
  
  // Test webhooks
  setTimeout(async () => {
    const orderId = '69246fedbcc220e6f3894d0f';
    const waybill = 'MOCK1768192020511';
    
    console.log('\n🧪 Testing webhooks...');
    
    // Test 1: In Transit
    try {
      const response1 = await axios.post('http://localhost:4002/api/deliveryone/webhook', {
        waybill: waybill,
        order: `ORD-${orderId}`,
        status: 'In Transit',
        current_status: 'In Transit',
        location: 'Mumbai Hub'
      }, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-token' }
      });
      console.log('✅ In Transit:', response1.status, response1.data.success);
    } catch (error) {
      console.log('❌ In Transit failed:', error.response?.status, error.response?.data);
    }
    
    // Test 2: Delivered
    try {
      const response2 = await axios.post('http://localhost:4002/api/deliveryone/webhook', {
        waybill: waybill,
        order: `ORD-${orderId}`,
        status: 'Delivered',
        current_status: 'Delivered',
        delivered_date: new Date().toISOString(),
        location: 'Customer Address'
      }, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-token' }
      });
      console.log('✅ Delivered:', response2.status, response2.data.success);
    } catch (error) {
      console.log('❌ Delivered failed:', error.response?.status, error.response?.data);
    }
    
    // Check final order state
    const Order = require('./models/Order');
    const order = await Order.findById(orderId);
    console.log('\n📊 Final Order State:');
    console.log('   Status:', order.status);
    console.log('   DeliveryOne Status:', order.deliveryOne?.status);
    console.log('   Delivered Date:', order.deliveryOne?.deliveredDate);
    console.log('   Webhook History Count:', order.deliveryOne?.webhookHistory?.length || 0);
    
    process.exit(0);
  }, 2000);
});
