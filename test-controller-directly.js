require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const delhiveryService = require('./utils/deliveryOne');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function testControllerDirectly() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');
    
    const identifier = '69246fedbcc220e6f3894d0f';
    const orderType = 'regular';
    
    console.log('\n🔍 Testing controller logic directly...');
    console.log('Identifier:', identifier);
    console.log('OrderType:', orderType);
    
    // Check if identifier is an order ID or waybill
    if (identifier.match(/^[a-f0-9]{24}$/i)) {
      console.log('✅ Regex matches - treating as order ID');
      
      let order;
      if (orderType === 'custom') {
        order = await Order.findById(identifier);
      } else {
        order = await Order.findById(identifier);
      }

      console.log('Order found:', !!order);
      
      if (order) {
        console.log('Order ID:', order._id.toString());
        console.log('Has deliveryOne:', !!order.deliveryOne);
        console.log('Waybill:', order.deliveryOne?.waybill);
        console.log('AWB Code:', order.deliveryOne?.awbCode);
        
        const waybill = order.deliveryOne?.waybill || order.deliveryOne?.awbCode;
        console.log('Final waybill:', waybill);
        
        if (waybill) {
          console.log('\n📍 Testing tracking service...');
          try {
            const trackingData = await delhiveryService.trackShipment(waybill);
            console.log('✅ Tracking data received');
            console.log('Has ShipmentData:', !!trackingData.ShipmentData);
            if (trackingData.ShipmentData) {
              console.log('Shipment count:', trackingData.ShipmentData.length);
            }
          } catch (error) {
            console.log('❌ Tracking service failed:', error.message);
          }
        }
      }
    } else {
      console.log('❌ Regex does not match');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testControllerDirectly();
