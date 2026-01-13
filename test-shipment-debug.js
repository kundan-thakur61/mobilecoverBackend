require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('./models/Order');
const CustomOrder = require('./models/CustomOrder');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';
const API_BASE_URL = process.env.DELHIVERY_API_BASE_URL || 'https://staging-express.delhivery.com';
const API_KEY = process.env.DELHIVERY_API_KEY || process.env.DELIVERYONE_API_KEY;

console.log('🔍 Shipment Update Debug Tool');
console.log('================================');
console.log(`API Base URL: ${API_BASE_URL}`);
console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
console.log('');

async function testDatabaseConnection() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testDelhiveryAuth() {
  console.log('\n🔐 Testing Delhivery Authentication...');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/backend/clientwarehouse/all/`, {
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ Auth Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ Authentication successful');
      return true;
    } else if (response.status === 401) {
      console.log('❌ Authentication failed - Invalid API key');
      return false;
    }
  } catch (error) {
    console.error('❌ Auth test failed:', error.response?.status || error.message);
    if (error.response?.status === 401) {
      console.log('❌ Invalid API key or authentication method');
    }
    return false;
  }
}

async function findOrdersWithShipments() {
  console.log('\n📦 Finding orders with shipments...');
  
  try {
    // Find regular orders with deliveryOne data
    const regularOrders = await Order.find({ 
      'deliveryOne.waybill': { $exists: true, $ne: null }
    }).limit(5).select('_id orderNumber deliveryOne status');
    
    // Find custom orders with deliveryOne data
    const customOrders = await CustomOrder.find({ 
      'deliveryOne.waybill': { $exists: true, $ne: null }
    }).limit(5).select('_id orderNumber deliveryOne status');
    
    console.log(`✅ Found ${regularOrders.length} regular orders with shipments`);
    console.log(`✅ Found ${customOrders.length} custom orders with shipments`);
    
    return [...regularOrders, ...customOrders];
  } catch (error) {
    console.error('❌ Failed to find orders:', error.message);
    return [];
  }
}

async function testShipmentTracking(waybill) {
  console.log(`\n📍 Testing shipment tracking for: ${waybill}`);
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/packages/json/`, {
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      params: {
        waybill: waybill,
        verbose: '1'
      },
      timeout: 10000
    });

    if (response.data && response.data.ShipmentData && response.data.ShipmentData.length > 0) {
      const shipment = response.data.ShipmentData[0].Shipment;
      console.log(`✅ Tracking data found`);
      console.log(`   Status: ${shipment.Status?.Status}`);
      console.log(`   Location: ${shipment.Status?.StatusLocation}`);
      console.log(`   Date: ${shipment.Status?.StatusDateTime}`);
      return { success: true, data: response.data };
    } else {
      console.log('❌ No tracking data found');
      return { success: false, message: 'No tracking data' };
    }
  } catch (error) {
    console.error('❌ Tracking request failed:', error.response?.status || error.message);
    return { success: false, error: error.message };
  }
}

async function testBackendTrackingAPI(orderId, orderType = 'regular') {
  console.log(`\n🌐 Testing backend tracking API for order: ${orderId}`);
  
  try {
    const response = await axios.get(`http://localhost:4000/api/deliveryone/track/${orderId}`, {
      params: { orderType },
      timeout: 10000
    });

    console.log(`✅ Backend API response: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    if (response.data.success) {
      console.log(`   Status: ${response.data.data?.status}`);
      console.log(`   Location: ${response.data.data?.location}`);
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Backend API request failed:', error.response?.status || error.message);
    if (error.response?.data) {
      console.log('   Error details:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

async function updateOrderFromTracking(order, trackingData) {
  console.log(`\n🔄 Testing order update from tracking data...`);
  
  try {
    const shipmentInfo = trackingData.ShipmentData[0].Shipment;
    const currentStatus = shipmentInfo.Status?.Status;
    
    // Simulate the update logic from the controller
    if (currentStatus?.toLowerCase().includes('delivered')) {
      order.status = 'delivered';
    } else if (currentStatus?.toLowerCase().includes('transit') || currentStatus?.toLowerCase().includes('pickup')) {
      order.status = 'shipped';
    }
    
    // Update deliveryOne tracking data
    if (!order.deliveryOne) order.deliveryOne = {};
    
    order.deliveryOne.trackingData = {
      currentStatus: shipmentInfo.Status?.Status,
      statusLocation: shipmentInfo.Status?.StatusLocation,
      statusDateTime: shipmentInfo.Status?.StatusDateTime,
      shipmentTrack: shipmentInfo.Scans?.map(scan => ({
        status: scan.ScanDetail?.Scan,
        date: scan.ScanDetail?.ScanDateTime,
        location: scan.ScanDetail?.ScanLocation,
        activity: scan.ScanDetail?.Instructions,
        scannedBy: scan.ScanDetail?.ScannedBy
      })) || []
    };
    order.deliveryOne.lastSyncedAt = new Date();
    
    await order.save();
    
    console.log(`✅ Order updated successfully`);
    console.log(`   New status: ${order.status}`);
    console.log(`   Last synced: ${order.deliveryOne.lastSyncedAt}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Order update failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testWebhookSimulation(order) {
  console.log(`\n🪝 Testing webhook simulation...`);
  
  try {
    const webhookPayload = {
      waybill: order.deliveryOne.waybill,
      order: order._id.toString(),
      status: 'Delivered',
      current_status: 'Delivered',
      delivered_date: new Date().toISOString()
    };
    
    const response = await axios.post('http://localhost:4000/api/webhooks/delhivery', webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.DELHIVERY_WEBHOOK_TOKEN || 'test-token'
      },
      timeout: 10000
    });
    
    console.log(`✅ Webhook simulation response: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Webhook simulation failed:', error.response?.status || error.message);
    if (error.response?.data) {
      console.log('   Error details:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Starting comprehensive shipment update test...\n');
  
  // Test 1: Database Connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log('\n❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Test 2: Delhivery Authentication
  const authValid = await testDelhiveryAuth();
  if (!authValid) {
    console.log('\n❌ Cannot proceed without valid Delhivery authentication');
    process.exit(1);
  }
  
  // Test 3: Find orders with shipments
  const orders = await findOrdersWithShipments();
  if (orders.length === 0) {
    console.log('\n⚠️  No orders with shipments found. Creating test scenario...');
    console.log('   Please create some orders with shipments first.');
    process.exit(0);
  }
  
  // Test each order
  for (const order of orders) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing Order: ${order._id}`);
    console.log(`Type: ${order.__t === 'CustomOrder' ? 'Custom' : 'Regular'}`);
    console.log(`Current Status: ${order.status}`);
    console.log(`Waybill: ${order.deliveryOne.waybill}`);
    console.log(`Last Synced: ${order.deliveryOne.lastSyncedAt || 'Never'}`);
    
    // Test 4: Direct Delhivery Tracking
    const trackingResult = await testShipmentTracking(order.deliveryOne.waybill);
    
    if (trackingResult.success) {
      // Test 5: Update order from tracking data
      await updateOrderFromTracking(order, trackingResult.data);
    }
    
    // Test 6: Backend Tracking API
    await testBackendTrackingAPI(order._id, order.__t === 'CustomOrder' ? 'custom' : 'regular');
    
    // Test 7: Webhook Simulation
    await testWebhookSimulation(order);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 SUMMARY');
  console.log('='.repeat(50));
  console.log('✅ Tests completed. Check the output above for any issues.');
  console.log('\nCommon issues and solutions:');
  console.log('1. ❌ Authentication failed → Check API key in .env');
  console.log('2. ❌ No tracking data → Waybill may be invalid or not active');
  console.log('3. ❌ Backend API failed → Check if server is running on port 4000');
  console.log('4. ❌ Order update failed → Check database permissions and schema');
  console.log('5. ❌ Webhook failed → Check webhook token configuration');
  
  await mongoose.connection.close();
  process.exit(0);
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
