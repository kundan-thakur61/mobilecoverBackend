require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const CustomOrder = require('./models/CustomOrder');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function main() {
  console.log('🔍 DIAGNOSING SHIPMENT UPDATE ISSUE');
  console.log('=====================================');
  
  // Connect to database
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  // Test 1: Check if backend server is running
  console.log('\n🌐 Testing Backend Server...');
  try {
    const healthResponse = await axios.get('http://localhost:4000/api/health', { timeout: 5000 });
    console.log('✅ Backend server is running');
  } catch (error) {
    console.log('❌ Backend server is not running');
    console.log('   Please start: npm start');
    await mongoose.connection.close();
    return;
  }
  
  // Test 2: Check serviceability (public endpoint)
  console.log('\n🔍 Testing Serviceability Endpoint...');
  try {
    const serviceResponse = await axios.get('http://localhost:4000/api/deliveryone/check-serviceability', {
      params: {
        pickupPincode: '400001',
        deliveryPincode: '110001',
        weight: 0.15,
        cod: 0
      }
    });
    console.log('✅ Serviceability endpoint works');
    console.log(`   Serviceable: ${serviceResponse.data.data?.serviceable}`);
  } catch (error) {
    console.error('❌ Serviceability endpoint failed:', error.response?.data || error.message);
  }
  
  // Test 3: Find orders and check their current state
  console.log('\n📦 Analyzing Orders...');
  try {
    const allOrders = await Order.find({}).limit(5);
    console.log(`✅ Found ${allOrders.length} regular orders`);
    
    const ordersWithShipments = await Order.find({ 
      'deliveryOne.waybill': { $exists: true, $ne: null }
    });
    console.log(`✅ Found ${ordersWithShipments.length} orders with shipments`);
    
    if (ordersWithShipments.length > 0) {
      for (const order of ordersWithShipments.slice(0, 2)) {
        console.log(`\n📋 Order Analysis: ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Waybill: ${order.deliveryOne.waybill}`);
        console.log(`   Last Synced: ${order.deliveryOne.lastSyncedAt || 'Never'}`);
        console.log(`   Has Tracking Data: ${!!order.deliveryOne.trackingData}`);
        
        // Test 4: Try to track this order
        console.log(`   📍 Testing tracking...`);
        try {
          const trackResponse = await axios.get(`http://localhost:4000/api/deliveryone/track/${order._id}`);
          console.log(`   ✅ Tracking API Status: ${trackResponse.status}`);
          console.log(`   ✅ Tracking Success: ${trackResponse.data.success}`);
          
          if (trackResponse.data.success) {
            console.log(`   📊 Current Status: ${trackResponse.data.data?.status}`);
            console.log(`   📍 Location: ${trackResponse.data.data?.location}`);
            
            // Check if order was updated after tracking call
            const updatedOrder = await Order.findById(order._id);
            console.log(`   🔄 Order Status After Tracking: ${updatedOrder.status}`);
            console.log(`   🔄 Last Synced After Tracking: ${updatedOrder.deliveryOne.lastSyncedAt}`);
            
            // Compare before and after
            const wasUpdated = updatedOrder.deliveryOne.lastSyncedAt?.getTime() !== order.deliveryOne.lastSyncedAt?.getTime();
            console.log(`   ✅ Order Updated: ${wasUpdated ? 'YES' : 'NO'}`);
            
            if (!wasUpdated) {
              console.log(`   ⚠️  ISSUE: Order was NOT updated after tracking call!`);
            }
          }
        } catch (error) {
          console.error(`   ❌ Tracking failed:`, error.response?.data || error.message);
        }
      }
    } else {
      console.log('\n⚠️  No orders with shipments found');
      console.log('   Creating a test shipment...');
      
      // Find an order without shipment
      const orderWithoutShipment = await Order.findOne({ 
        'deliveryOne.waybill': { $exists: false }
      });
      
      if (orderWithoutShipment) {
        console.log(`   🎯 Found order: ${orderWithoutShipment._id}`);
        
        // Test 5: Try to create shipment (will fail without auth, but we can see the error)
        console.log(`   📦 Testing shipment creation (expected to fail without auth)...`);
        try {
          const createResponse = await axios.post('http://localhost:4000/api/deliveryone/create-shipment', {
            orderId: orderWithoutShipment._id,
            orderType: 'regular',
            pickupLocation: 'Primary',
            weight: 0.15
          });
          console.log(`   ✅ Unexpected success: ${createResponse.status}`);
        } catch (error) {
          console.log(`   ❌ Expected auth failure: ${error.response?.status}`);
          if (error.response?.status === 401) {
            console.log(`   ✅ This is normal - admin authentication required`);
          }
        }
      }
    }
    
    // Test 6: Test webhook endpoint
    console.log(`\n🪝 Testing Webhook Endpoint...`);
    try {
      const webhookPayload = {
        waybill: 'TEST123456789',
        order: 'TEST-ORDER-ID',
        status: 'Delivered',
        current_status: 'Delivered',
        delivered_date: new Date().toISOString()
      };
      
      const webhookResponse = await axios.post('http://localhost:4000/api/deliveryone/webhook', webhookPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.DELHIVERY_WEBHOOK_TOKEN || 'test-token'
        }
      });
      
      console.log(`✅ Webhook Status: ${webhookResponse.status}`);
      console.log(`✅ Webhook Success: ${webhookResponse.data.success}`);
      
    } catch (error) {
      console.error(`❌ Webhook failed:`, error.response?.status);
      if (error.response?.status === 404) {
        console.log(`   ⚠️  Webhook route not found - check routes configuration`);
      } else if (error.response?.status === 401) {
        console.log(`   ⚠️  Webhook authentication failed - check DELHIVERY_WEBHOOK_TOKEN`);
      }
    }
    
    // Test 7: Test alternative webhook route
    console.log(`\n🪝 Testing Alternative Webhook Route...`);
    try {
      const webhookResponse2 = await axios.post('http://localhost:4000/api/webhooks/delhivery', {
        waybill: 'TEST123456789',
        status: 'Delivered'
      });
      
      console.log(`✅ Alternative Webhook Status: ${webhookResponse2.status}`);
      console.log(`✅ Alternative Webhook Success: ${webhookResponse2.data.success}`);
      
    } catch (error) {
      console.error(`❌ Alternative webhook failed:`, error.response?.status);
    }
    
  } catch (error) {
    console.error('❌ Database analysis failed:', error.message);
  }
  
  // Test 8: Check Delhivery service configuration
  console.log(`\n⚙️  Delhivery Service Configuration...`);
  console.log(`   API Key: ${process.env.DELHIVERY_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   Base URL: ${process.env.DELHIVERY_API_BASE_URL || 'DEFAULT'}`);
  console.log(`   Webhook Token: ${process.env.DELHIVERY_WEBHOOK_TOKEN ? 'SET' : 'NOT SET'}`);
  
  // Test the Delhivery service directly
  try {
    const delhiveryService = require('./utils/deliveryOne');
    console.log(`   ✅ Delhivery service loaded`);
    
    // Test mock functionality
    const mockResult = delhiveryService.mockRequest('GET', '/test');
    console.log(`   ✅ Mock implementation working: ${mockResult.success}`);
    
  } catch (error) {
    console.error(`   ❌ Delhivery service error:`, error.message);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 DIAGNOSIS COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nCOMMON ISSUES & SOLUTIONS:`);
  console.log(`1. ❌ Orders not updated after tracking → Check trackShipment controller logic`);
  console.log(`2. ❌ Webhook not working → Check webhook route and authentication`);
  console.log(`3. ❌ Delhivery API failing → Using mock implementation (check logs)`);
  console.log(`4. ❌ Admin endpoints failing → Need proper authentication token`);
  console.log(`5. ❌ No shipments exist → Need to create shipments first`);
  
  console.log(`\nNEXT STEPS:`);
  console.log(`1. Check if tracking API calls are updating orders in database`);
  console.log(`2. Verify webhook endpoint is receiving and processing updates`);
  console.log(`3. Test with real Delhivery API credentials`);
  console.log(`4. Check frontend is calling tracking API correctly`);
  
  await mongoose.connection.close();
}

main().catch(error => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
});
