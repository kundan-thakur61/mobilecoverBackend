require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function testOrderLookup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');
    
    const orderId = '69246fedbcc220e6f3894d0f';
    console.log(`\n🔍 Looking for order: ${orderId}`);
    
    // Test direct lookup
    const order = await Order.findById(orderId);
    console.log(`✅ Direct lookup result:`, !!order);
    
    if (order) {
      console.log(`   Order ID: ${order._id}`);
      console.log(`   Has deliveryOne:`, !!order.deliveryOne);
      console.log(`   Waybill:`, order.deliveryOne?.waybill);
      console.log(`   Status:`, order.status);
    }
    
    // Test regex matching
    const isObjectId = orderId.match(/^[a-f0-9]{24}$/i);
    console.log(`\n🔍 Regex test:`, !!isObjectId);
    
    // Test the exact same logic as controller
    if (orderId.match(/^[a-f0-9]{24}$/i)) {
      console.log(`✅ Regex matches, looking up order...`);
      const testOrder = await Order.findById(orderId);
      console.log(`   Found:`, !!testOrder);
      
      if (!testOrder) {
        console.log(`❌ This is the issue - Order.findById() is returning null`);
        
        // Try to find all orders to see what's available
        const allOrders = await Order.find({}).limit(5);
        console.log(`\n📋 Available orders:`);
        allOrders.forEach(o => {
          console.log(`   ID: ${o._id}, Status: ${o.status}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testOrderLookup();
