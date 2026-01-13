require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function createTestShipment() {
  console.log('🚀 Creating Test Shipment and Testing Updates');
  console.log('=============================================');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  // Find an order without shipment
  const order = await Order.findOne({ 
    'deliveryOne.waybill': { $exists: false }
  });
  
  if (!order) {
    console.log('❌ No orders available for testing');
    await mongoose.connection.close();
    return;
  }
  
  console.log(`\n📦 Using Order: ${order._id}`);
  console.log(`   Current Status: ${order.status}`);
  console.log(`   Shipping Address: ${order.shippingAddress?.city}, ${order.shippingAddress?.postalCode}`);
  
  // Step 1: Create a mock shipment directly in the database
  console.log(`\n📋 Step 1: Creating mock shipment...`);
  const mockWaybill = `MOCK${Date.now()}`;
  
  order.deliveryOne = {
    shipmentId: `MOCK-SHIPMENT-${Date.now()}`,
    waybill: mockWaybill,
    awbCode: mockWaybill,
    orderId: `ORD-${order._id}`,
    status: 'Manifested',
    statusCode: 'Manifested',
    lastSyncedAt: new Date(),
    remarks: 'Mock shipment for testing'
  };
  
  order.trackingNumber = mockWaybill;
  await order.save();
  
  console.log(`✅ Mock shipment created`);
  console.log(`   Waybill: ${mockWaybill}`);
  console.log(`   Status: ${order.deliveryOne.status}`);
  
  // Step 2: Test tracking API call
  console.log(`\n📍 Step 2: Testing tracking API...`);
  try {
    const trackResponse = await axios.get(`http://localhost:4000/api/deliveryone/track/${order._id}`);
    console.log(`✅ Tracking API Status: ${trackResponse.status}`);
    console.log(`   Success: ${trackResponse.data.success}`);
    
    if (trackResponse.data.success) {
      console.log(`   Returned Status: ${trackResponse.data.data?.status}`);
      console.log(`   Location: ${trackResponse.data.data?.location}`);
      
      // Check if order was updated
      const updatedOrder = await Order.findById(order._id);
      console.log(`   Order Status After Tracking: ${updatedOrder.status}`);
      console.log(`   Last Synced: ${updatedOrder.deliveryOne.lastSyncedAt}`);
      
      const wasUpdated = updatedOrder.deliveryOne.lastSyncedAt?.getTime() !== order.deliveryOne.lastSyncedAt?.getTime();
      console.log(`   ✅ Order Updated by Tracking: ${wasUpdated ? 'YES' : 'NO'}`);
      
      if (!wasUpdated) {
        console.log(`   ⚠️  ISSUE FOUND: Tracking API did not update the order!`);
      }
    }
  } catch (error) {
    console.error(`❌ Tracking API failed:`, error.response?.data || error.message);
  }
  
  // Step 3: Test webhook with real order ID
  console.log(`\n🪝 Step 3: Testing webhook with real order ID...`);
  try {
    const webhookPayload = {
      waybill: mockWaybill,
      order: `ORD-${order._id}`, // Use the format expected by webhook
      status: 'In Transit',
      current_status: 'In Transit',
      location: 'Mumbai Hub',
      instructions: 'Package in transit'
    };
    
    const webhookResponse = await axios.post('http://localhost:4000/api/deliveryone/webhook', webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-token' // Using test token since webhook token is not set
      }
    });
    
    console.log(`✅ Webhook Status: ${webhookResponse.status}`);
    console.log(`   Success: ${webhookResponse.data.success}`);
    
    // Check if order was updated by webhook
    const webhookUpdatedOrder = await Order.findById(order._id);
    console.log(`   Order Status After Webhook: ${webhookUpdatedOrder.status}`);
    console.log(`   DeliveryOne Status: ${webhookUpdatedOrder.deliveryOne.status}`);
    
    const webhookUpdated = webhookUpdatedOrder.deliveryOne.status === 'In Transit';
    console.log(`   ✅ Order Updated by Webhook: ${webhookUpdated ? 'YES' : 'NO'}`);
    
    if (!webhookUpdated) {
      console.log(`   ⚠️  ISSUE FOUND: Webhook did not update the order!`);
    }
    
  } catch (error) {
    console.error(`❌ Webhook failed:`, error.response?.data || error.message);
  }
  
  // Step 4: Test status change to Delivered
  console.log(`\n📬 Step 4: Testing delivered status...`);
  try {
    const deliveredPayload = {
      waybill: mockWaybill,
      order: `ORD-${order._id}`,
      status: 'Delivered',
      current_status: 'Delivered',
      delivered_date: new Date().toISOString(),
      location: 'Customer Address'
    };
    
    const deliveredResponse = await axios.post('http://localhost:4000/api/deliveryone/webhook', deliveredPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-token'
      }
    });
    
    console.log(`✅ Delivered Webhook Status: ${deliveredResponse.status}`);
    console.log(`   Success: ${deliveredResponse.data.success}`);
    
    // Check final order status
    const finalOrder = await Order.findById(order._id);
    console.log(`   Final Order Status: ${finalOrder.status}`);
    console.log(`   Final DeliveryOne Status: ${finalOrder.deliveryOne.status}`);
    console.log(`   Delivered Date: ${finalOrder.deliveryOne.deliveredDate}`);
    
    const correctlyDelivered = finalOrder.status === 'delivered' && finalOrder.deliveryOne.status === 'Delivered';
    console.log(`   ✅ Order Correctly Marked Delivered: ${correctlyDelivered ? 'YES' : 'NO'}`);
    
    if (!correctlyDelivered) {
      console.log(`   ⚠️  CRITICAL ISSUE: Delivered status not properly set!`);
    }
    
  } catch (error) {
    console.error(`❌ Delivered webhook failed:`, error.response?.data || error.message);
  }
  
  // Step 5: Test tracking by waybill
  console.log(`\n🔍 Step 5: Testing tracking by waybill...`);
  try {
    const waybillResponse = await axios.get(`http://localhost:4000/api/deliveryone/track/${mockWaybill}`);
    console.log(`✅ Waybill Tracking Status: ${waybillResponse.status}`);
    console.log(`   Success: ${waybillResponse.data.success}`);
    
    if (waybillResponse.data.success) {
      console.log(`   Status: ${waybillResponse.data.data?.status}`);
      console.log(`   Location: ${waybillResponse.data.data?.location}`);
    }
  } catch (error) {
    console.error(`❌ Waybill tracking failed:`, error.response?.data || error.message);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 SHIPMENT UPDATE TEST COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nSUMMARY OF ISSUES FOUND:`);
  console.log(`1. Tracking API updates: Check if orders are updated after tracking calls`);
  console.log(`2. Webhook processing: Check if webhooks properly update order status`);
  console.log(`3. Status mapping: Verify Delhivery status to order status mapping`);
  console.log(`4. Authentication: Webhook token configuration`);
  
  console.log(`\nTEST ORDER ID: ${order._id}`);
  console.log(`TEST WAYBILL: ${mockWaybill}`);
  console.log(`\nYou can manually test these in the frontend or API tools.`);
  
  await mongoose.connection.close();
}

createTestShipment().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
