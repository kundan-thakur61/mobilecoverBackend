/**
 * Create Sample Shipment Test
 * 
 * This script creates a test shipment to verify end-to-end integration.
 * Make sure you have:
 * 1. Added DeliveryOne credentials to .env
 * 2. Configured pickup location in DeliveryOne dashboard
 * 3. An order in your database (or use the sample data below)
 * 
 * Run: node scripts/createSampleShipment.js <orderId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const deliveryOneService = require('../utils/deliveryOne');
const logger = require('../utils/logger');

// Sample test order data (if no real order exists)
const sampleOrderData = {
  orderId: `TEST-${Date.now()}`,
  orderDate: new Date().toISOString().split('T')[0],
  pickupLocation: 'Primary',
  billingCustomerName: 'Test',
  billingLastName: 'Customer',
  billingAddress: 'Test Address Line 1',
  billingAddress2: 'Test Address Line 2',
  billingCity: 'Mumbai',
  billingPincode: '400001',
  billingState: 'Maharashtra',
  billingCountry: 'India',
  billingEmail: 'test@example.com',
  billingPhone: '9876543210',
  shippingIsBilling: true,
  orderItems: [{
    name: 'Custom Mobile Cover',
    sku: 'TEST-SKU-001',
    units: 1,
    selling_price: 499,
    discount: 0,
    tax: 0,
    hsn: 392690
  }],
  paymentMethod: 'Prepaid',
  subTotal: 499,
  length: 15,
  breadth: 10,
  height: 2,
  weight: 0.15
};

async function createTestShipment(orderId = null) {
  try {
    console.log('\n📦 Creating Test Shipment...\n');

    // Connect to database if orderId is provided
    if (orderId) {
      console.log('Connecting to database...');
      await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
      console.log('✅ Connected to database\n');

      // Find the order
      const order = await Order.findById(orderId).populate('userId');
      
      if (!order) {
        console.log('❌ Order not found!');
        console.log('Creating a sample test shipment instead...\n');
        await createSampleShipment();
        return;
      }

      console.log(`Found order: ${order._id}`);
      console.log(`Customer: ${order.shippingAddress?.name}`);
      console.log(`Total: ₹${order.total}`);
      console.log(`Payment Status: ${order.payment?.status}\n`);

      // Use the helper to create shipment
      console.log('Creating shipment in DeliveryOne...');
      const result = await deliveryOneService.createOrder(order, {
        orderType: 'regular',
        pickupLocation: 'Primary',
        autoAssignCourier: true,
        requestPickup: false
      });

      if (result && result.success) {
        console.log('\n✅ Shipment Created Successfully!');
        console.log(`   Shipment ID: ${result.shipmentId}`);
        console.log(`   Order ID: ${result.orderId}`);
        if (result.awbCode) {
          console.log(`   AWB Code: ${result.awbCode}`);
          console.log(`   Courier: ${result.courierName}`);
        }
        console.log('\n✨ You can now:');
        console.log(`   - Track shipment: GET /api/deliveryone/track/${orderId}`);
        console.log(`   - Generate label: POST /api/deliveryone/generate-label`);
        console.log(`   - Request pickup: POST /api/deliveryone/request-pickup\n`);
      } else {
        console.log('\n⚠️  Shipment creation had issues - check logs above');
      }

      await mongoose.disconnect();

    } else {
      // Create sample shipment without database
      await createSampleShipment();
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function createSampleShipment() {
  console.log('Creating sample test shipment (no database)...\n');
  console.log('📋 Sample Order Details:');
  console.log(JSON.stringify(sampleOrderData, null, 2));
  console.log('\n');

  try {
    // Create shipment
    const result = await deliveryOneService.createOrder(sampleOrderData);
    
    console.log('✅ Sample Shipment Created!');
    console.log(`   Shipment ID: ${result.shipment_id}`);
    console.log(`   Order ID: ${result.order_id}`);
    console.log(`   Status: ${result.status}\n`);

    // Try to get recommended couriers
    if (result.shipment_id) {
      console.log('Fetching recommended couriers...');
      const couriers = await deliveryOneService.getRecommendedCouriers(result.shipment_id);
      
      if (couriers && couriers.length > 0) {
        console.log(`✅ Found ${couriers.length} available couriers:`);
        couriers.slice(0, 5).forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.courier_name} - ₹${c.freight_charge} (${c.estimated_delivery_days})`);
        });

        // Auto-assign cheapest courier
        const cheapest = couriers.sort((a, b) => a.freight_charge - b.freight_charge)[0];
        console.log(`\nAuto-assigning cheapest courier: ${cheapest.courier_name}`);
        
        const awbResult = await deliveryOneService.assignCourier(
          result.shipment_id,
          cheapest.courier_company_id
        );

        if (awbResult.awb_code) {
          console.log(`✅ AWB Generated: ${awbResult.awb_code}\n`);
          
          console.log('✨ Test shipment is ready!');
          console.log(`   You can track it at: https://deliveryone.com/tracking/${awbResult.awb_code}`);
          console.log('\n⚠️  Note: This is a test shipment. Cancel it in DeliveryOne dashboard if not needed.\n');
        }
      }
    }

  } catch (error) {
    console.error('Failed to create sample shipment:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Get orderId from command line argument
const orderId = process.argv[2];

console.log('🚀 DeliveryOne Sample Shipment Creator\n');
console.log('Usage: node scripts/createSampleShipment.js [orderId]');
console.log('       Without orderId: Creates a test shipment with sample data');
console.log('       With orderId: Creates shipment for an actual order from database\n');

if (orderId) {
  console.log(`Using order ID: ${orderId}\n`);
} else {
  console.log('No order ID provided - will create sample test shipment\n');
}

createTestShipment(orderId).then(() => {
  console.log('Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
