require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function updateTestOrder() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');
    
    const order = await Order.findById('69246fedbcc220e6f3894d0f');
    console.log('Current deliveryOne:', JSON.stringify(order.deliveryOne, null, 2));
    
    // Update with proper waybill
    const mockWaybill = 'MOCK' + Date.now();
    order.deliveryOne.waybill = mockWaybill;
    order.trackingNumber = mockWaybill;
    await order.save();
    
    console.log('Updated with waybill:', mockWaybill);
    
    // Verify the update
    const updated = await Order.findById('69246fedbcc220e6f3894d0f');
    console.log('Verified waybill:', updated.deliveryOne.waybill);
    console.log('Verified trackingNumber:', updated.trackingNumber);
    
  } catch (error) {
    console.error('❌ Update failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

updateTestOrder();
