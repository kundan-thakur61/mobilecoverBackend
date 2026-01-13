require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const CustomOrder = require('./models/CustomOrder');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function main() {
  console.log('🔍 Testing Local Backend API');
  console.log('============================');
  
  // Connect to database
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  // Check if backend server is running
  try {
    const response = await axios.get('http://localhost:4000/api/health', { timeout: 5000 });
    console.log('✅ Backend server is running');
  } catch (error) {
    console.log('❌ Backend server is not running on port 4000');
    console.log('   Please start the backend server first');
    await mongoose.connection.close();
    return;
  }
  
  // Find orders with shipments
  try {
    const regularOrders = await Order.find({ 
      'deliveryOne.waybill': { $exists: true, $ne: null }
    }).limit(3);
    
    const customOrders = await CustomOrder.find({ 
      'deliveryOne.waybill': { $exists: true, $ne: null }
    }).limit(3);
    
    console.log(`\n📦 Found ${regularOrders.length} regular orders with shipments`);
    console.log(`📦 Found ${customOrders.length} custom orders with shipments`);
    
    const allOrders = [...regularOrders, ...customOrders];
    
    if (allOrders.length === 0) {
      console.log('\n⚠️  No orders with shipments found');
      console.log('   Let\'s create a test shipment first...');
      
      // Find any order without shipment
      const anyOrder = await Order.findOne({ 'deliveryOne.waybill': { $exists: false } });
      if (anyOrder) {
        console.log(`\n🎯 Found order without shipment: ${anyOrder._id}`);
        console.log('   Testing shipment creation...');
        
        try {
          const createResponse = await axios.post('http://localhost:4000/api/deliveryone/create-shipment', {
            orderId: anyOrder._id,
            orderType: 'regular',
            pickupLocation: 'Primary',
            weight: 0.15,
            dimensions: { length: 15, breadth: 10, height: 2 }
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer fake-admin-token'
            }
          });
          
          console.log('✅ Shipment creation response:', createResponse.status);
          console.log('   Data:', JSON.stringify(createResponse.data, null, 2));
          
          // Now test tracking with the new shipment
          if (createResponse.data.success) {
            const waybill = createResponse.data.data.waybill;
            console.log(`\n📍 Testing tracking for new waybill: ${waybill}`);
            
            const trackResponse = await axios.get(`http://localhost:4000/api/deliveryone/track/${waybill}`);
            console.log('✅ Tracking response:', trackResponse.status);
            console.log('   Data:', JSON.stringify(trackResponse.data, null, 2));
          }
          
        } catch (error) {
          console.error('❌ Shipment creation failed:', error.response?.data || error.message);
        }
      }
    } else {
      // Test existing orders
      for (const order of allOrders) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Testing Order: ${order._id}`);
        console.log(`Status: ${order.status}`);
        console.log(`Waybill: ${order.deliveryOne.waybill}`);
        console.log(`Last Synced: ${order.deliveryOne.lastSyncedAt || 'Never'}`);
        
        // Test tracking API
        try {
          const trackResponse = await axios.get(`http://localhost:4000/api/deliveryone/track/${order._id}`, {
            params: { orderType: order.__t === 'CustomOrder' ? 'custom' : 'regular' }
          });
          
          console.log(`✅ Tracking API Status: ${trackResponse.status}`);
          console.log(`   Success: ${trackResponse.data.success}`);
          
          if (trackResponse.data.success) {
            console.log(`   Current Status: ${trackResponse.data.data?.status}`);
            console.log(`   Location: ${trackResponse.data.data?.location}`);
            
            // Check if order was updated
            await order.reload();
            console.log(`   Order Status After API Call: ${order.status}`);
            console.log(`   Last Synced After API Call: ${order.deliveryOne.lastSyncedAt}`);
          }
          
        } catch (error) {
          console.error(`❌ Tracking API failed:`, error.response?.data || error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
  }
  
  // Test webhook endpoint
  console.log(`\n${'='.repeat(50)}`);
  console.log('🪝 Testing Webhook Endpoint');
  
  try {
    const webhookResponse = await axios.post('http://localhost:4000/api/webhooks/delhivery', {
      waybill: 'TEST123456789',
      order: 'TEST-ORDER-123',
      status: 'Delivered',
      current_status: 'Delivered'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Webhook Status: ${webhookResponse.status}`);
    console.log(`   Success: ${webhookResponse.data.success}`);
    
  } catch (error) {
    console.error(`❌ Webhook failed:`, error.response?.data || error.message);
  }
  
  console.log('\n🎯 SUMMARY');
  console.log('==========');
  console.log('1. Check if backend server is running on port 4000');
  console.log('2. Verify orders have deliveryOne.waybill field');
  console.log('3. Test tracking API calls update order status');
  console.log('4. Test webhook endpoint receives updates');
  console.log('5. Check Delhivery API authentication issues');
  
  await mongoose.connection.close();
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
