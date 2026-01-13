require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function testWebhookComprehensive() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Database connected');

    const orderId = '69246fedbcc220e6f3894d0f';
    const order = await Order.findById(orderId);
    
    if (!order) {
      console.log('❌ Test order not found');
      return;
    }

    console.log('\n📦 Starting webhook tests for order:', orderId);
    console.log('Current status:', order.status);
    console.log('Current deliveryOne status:', order.deliveryOne?.status);

    // Test 1: In Transit webhook
    console.log('\n🚚 Test 1: In Transit Webhook');
    const inTransitPayload = {
      waybill: order.deliveryOne.waybill,
      order: `ORD-${orderId}`,
      status: 'In Transit',
      current_status: 'In Transit',
      location: 'Mumbai Hub',
      instructions: 'Package in transit to destination'
    };

    try {
      const response1 = await axios.post('http://localhost:4000/api/deliveryone/webhook', inTransitPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      });

      console.log('✅ In Transit Webhook Status:', response1.status);
      console.log('✅ Success:', response1.data.success);

      // Check order update
      const updated1 = await Order.findById(orderId);
      console.log('Order status after In Transit:', updated1.status);
      console.log('DeliveryOne status after In Transit:', updated1.deliveryOne?.status);
      console.log('Webhook history count:', updated1.deliveryOne?.webhookHistory?.length || 0);

    } catch (error) {
      console.log('❌ In Transit Webhook failed:', error.response?.status, error.response?.data);
    }

    // Test 2: Out for Delivery webhook
    console.log('\n📬 Test 2: Out for Delivery Webhook');
    const outForDeliveryPayload = {
      waybill: order.deliveryOne.waybill,
      order: `ORD-${orderId}`,
      status: 'Out for Delivery',
      current_status: 'Out for Delivery',
      location: 'Local Delivery Center',
      instructions: 'Package out for delivery'
    };

    try {
      const response2 = await axios.post('http://localhost:4000/api/deliveryone/webhook', outForDeliveryPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      });

      console.log('✅ Out for Delivery Webhook Status:', response2.status);
      console.log('✅ Success:', response2.data.success);

      const updated2 = await Order.findById(orderId);
      console.log('Order status after Out for Delivery:', updated2.status);
      console.log('DeliveryOne status after Out for Delivery:', updated2.deliveryOne?.status);

    } catch (error) {
      console.log('❌ Out for Delivery Webhook failed:', error.response?.status, error.response?.data);
    }

    // Test 3: Delivered webhook
    console.log('\n🎯 Test 3: Delivered Webhook');
    const deliveredPayload = {
      waybill: order.deliveryOne.waybill,
      order: `ORD-${orderId}`,
      status: 'Delivered',
      current_status: 'Delivered',
      delivered_date: new Date().toISOString(),
      location: 'Customer Address',
      instructions: 'Package delivered successfully'
    };

    try {
      const response3 = await axios.post('http://localhost:4000/api/deliveryone/webhook', deliveredPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      });

      console.log('✅ Delivered Webhook Status:', response3.status);
      console.log('✅ Success:', response3.data.success);

      const updated3 = await Order.findById(orderId);
      console.log('Final order status:', updated3.status);
      console.log('Final deliveryOne status:', updated3.deliveryOne?.status);
      console.log('Delivered date:', updated3.deliveryOne?.deliveredDate);
      console.log('Total webhook history entries:', updated3.deliveryOne?.webhookHistory?.length || 0);

      // Verify webhook history
      if (updated3.deliveryOne?.webhookHistory?.length > 0) {
        console.log('\n📋 Webhook History:');
        updated3.deliveryOne.webhookHistory.forEach((entry, index) => {
          console.log(`   ${index + 1}. Status: ${entry.status}, Received: ${entry.receivedAt}`);
        });
      }

    } catch (error) {
      console.log('❌ Delivered Webhook failed:', error.response?.status, error.response?.data);
    }

    // Test 4: Invalid webhook (should fail gracefully)
    console.log('\n❌ Test 4: Invalid Webhook (should fail)');
    const invalidPayload = {
      waybill: 'INVALID123',
      order: 'INVALID-ORDER',
      status: 'Invalid Status'
    };

    try {
      const response4 = await axios.post('http://localhost:4000/api/deliveryone/webhook', invalidPayload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      });

      console.log('⚠️  Invalid Webhook unexpectedly succeeded:', response4.status);

    } catch (error) {
      console.log('✅ Invalid Webhook correctly failed:', error.response?.status);
      console.log('✅ Error message:', error.response?.data?.message);
    }

    // Test 5: Alternative webhook route
    console.log('\n🔄 Test 5: Alternative Webhook Route');
    try {
      const response5 = await axios.post('http://localhost:4000/api/webhooks/delhivery', {
        waybill: order.deliveryOne.waybill,
        status: 'Test Alternative Route'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-token'
        }
      });

      console.log('✅ Alternative Webhook Status:', response5.status);
      console.log('✅ Success:', response5.data.success);

    } catch (error) {
      console.log('❌ Alternative Webhook failed:', error.response?.status, error.response?.data);
    }

    console.log('\n🎯 WEBHOOK TESTING COMPLETE');

  } catch (error) {
    console.error('❌ Webhook test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testWebhookComprehensive();
