/**
 * DELHIVERY SAMPLE SHIPMENT CREATOR - CORRECTED VERSION
 * 
 * This script creates a test shipment to verify end-to-end Delhivery integration.
 * 
 * Setup Requirements:
 * 1. Add DELHIVERY_API_KEY to .env file
 * 2. Configure pickup location in Delhivery dashboard
 * 3. Ensure .env has all required variables (see .env.example)
 * 
 * Usage:
 *   node scripts/createSampleShipment.js                  # Create test shipment with sample data
 *   node scripts/createSampleShipment.js <orderId>        # Create shipment for real order
 *   node scripts/createSampleShipment.js --track <waybill> # Track existing shipment
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const delhiveryService = require('../utils/deliveryOne');
const logger = require('../utils/logger');

// Sample test order data
const sampleOrderData = {
  orderId: `TEST-${Date.now()}`,
  orderDate: new Date().toISOString().split('T')[0],
  pickupLocation: process.env.DELHIVERY_PICKUP_LOCATION || 'Primary',
  billingCustomerName: 'Test',
  billingLastName: 'Customer',
  billingAddress: '123 Test Street, Apartment 4B',
  billingAddress2: 'Near Central Mall',
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
    quantity: 1,
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

// =============================================================================
// Helper Functions
// =============================================================================

function printHeader(text) {
  console.log('\n' + '='.repeat(80));
  console.log('  ' + text);
  console.log('='.repeat(80) + '\n');
}

function printSuccess(text) {
  console.log('✅ ' + text);
}

function printError(text) {
  console.log('❌ ' + text);
}

function printInfo(text) {
  console.log('ℹ️  ' + text);
}

function printWarning(text) {
  console.log('⚠️  ' + text);
}

// =============================================================================
// Track Shipment Function
// =============================================================================

async function trackShipment(waybill) {
  try {
    printHeader('TRACKING SHIPMENT');
    printInfo(`Tracking waybill: ${waybill}`);

    const trackingData = await delhiveryService.trackShipment(waybill);

    if (!trackingData.ShipmentData || trackingData.ShipmentData.length === 0) {
      printError('No tracking data found for this waybill');
      return;
    }

    const shipment = trackingData.ShipmentData[0].Shipment;
    const status = shipment.Status;

    printSuccess('Tracking Data Retrieved');
    console.log('\n📦 Current Status:');
    console.log(`   Status: ${status.Status}`);
    console.log(`   Location: ${status.StatusLocation}`);
    console.log(`   Date/Time: ${status.StatusDateTime}`);
    console.log(`   Instructions: ${status.Instructions || 'N/A'}`);

    if (shipment.Scans && shipment.Scans.length > 0) {
      console.log('\n📊 Tracking History:');
      shipment.Scans.reverse().forEach((scan, index) => {
        const detail = scan.ScanDetail;
        console.log(`   ${index + 1}. ${detail.Scan}`);
        console.log(`      Date: ${detail.ScanDateTime}`);
        console.log(`      Location: ${detail.ScanLocation}`);
        console.log(`      Details: ${detail.Instructions || 'N/A'}`);
      });
    }

    console.log(`\n🔗 Track online: https://www.delhivery.com/track/package/${waybill}\n`);
  } catch (error) {
    printError(`Tracking failed: ${error.message}`);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// =============================================================================
// Create Shipment for Real Order
// =============================================================================

async function createShipmentForOrder(orderId) {
  try {
    printHeader('CREATING SHIPMENT FOR REAL ORDER');
    printInfo('Connecting to database...');
    
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    printSuccess('Connected to database');

    // Find the order
    const order = await Order.findById(orderId).populate('userId');
    
    if (!order) {
      printError('Order not found!');
      printInfo('Creating a sample test shipment instead...');
      await mongoose.disconnect();
      return createSampleShipment();
    }

    printSuccess(`Found order: ${order._id}`);
    console.log(`   Customer: ${order.shippingAddress?.name}`);
    console.log(`   Total: ₹${order.total}`);
    console.log(`   Payment: ${order.payment?.status}`);
    console.log(`   Status: ${order.status}`);

    // Check if shipment already exists
    if (order.deliveryOne?.waybill) {
      printWarning('Shipment already exists for this order!');
      console.log(`   Waybill: ${order.deliveryOne.waybill}`);
      console.log(`   Status: ${order.deliveryOne.status}`);
      
      const shouldTrack = process.argv.includes('--track') || process.argv.includes('-t');
      if (shouldTrack) {
        await mongoose.disconnect();
        return trackShipment(order.deliveryOne.waybill);
      }
      
      printInfo('Use --track flag to see tracking details');
      await mongoose.disconnect();
      return;
    }

    // Prepare order data
    const fullName = order.shippingAddress?.name || order.userId?.name || 'Customer';
    const nameParts = fullName.trim().split(' ');
    
    const orderData = {
      orderId: `ORD-${orderId}`,
      orderDate: order.createdAt.toISOString().split('T')[0],
      pickupLocation: process.env.DELHIVERY_PICKUP_LOCATION || 'Primary',
      billingCustomerName: nameParts[0],
      billingLastName: nameParts.slice(1).join(' ') || '',
      billingAddress: order.shippingAddress?.address1 || order.shippingAddress?.street,
      billingAddress2: order.shippingAddress?.address2 || '',
      billingCity: order.shippingAddress?.city,
      billingPincode: order.shippingAddress?.postalCode || order.shippingAddress?.zipCode,
      billingState: order.shippingAddress?.state,
      billingCountry: order.shippingAddress?.country || 'India',
      billingEmail: order.userId?.email || 'customer@example.com',
      billingPhone: order.shippingAddress?.phone || '0000000000',
      shippingIsBilling: true,
      orderItems: order.items.map(item => ({
        name: item.title || 'Product',
        sku: item.sku || item.variantId?.toString() || 'SKU-NA',
        units: item.quantity,
        quantity: item.quantity,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: 392690
      })),
      paymentMethod: order.payment?.status === 'paid' ? 'Prepaid' : 'COD',
      subTotal: order.total,
      length: 15,
      breadth: 10,
      height: 2,
      weight: 0.15
    };

    printInfo('Creating shipment in Delhivery...');
    const result = await delhiveryService.createOrder(orderData);

    if (result && result.success) {
      printSuccess('Shipment Created Successfully!');
      console.log(`   Shipment ID: ${result.shipment_id}`);
      console.log(`   Waybill: ${result.waybill}`);
      console.log(`   Order ID: ${result.order_id}`);
      console.log(`   Status: ${result.status}`);

      // Update order in database
      order.deliveryOne = {
        shipmentId: result.shipment_id,
        waybill: result.waybill,
        awbCode: result.waybill,
        orderId: result.order_id,
        status: result.status,
        lastSyncedAt: new Date()
      };
      order.trackingNumber = result.waybill;
      await order.save();

      printSuccess('Order updated in database');
      
      console.log('\n✨ Next Steps:');
      console.log(`   📍 Track: node scripts/createSampleShipment.js --track ${result.waybill}`);
      console.log(`   🔗 Online: https://www.delhivery.com/track/package/${result.waybill}`);
      console.log(`   📋 Dashboard: https://one.delhivery.com`);
    } else {
      printWarning('Shipment creation had issues - check logs above');
    }

    await mongoose.disconnect();
  } catch (error) {
    printError(`Error: ${error.message}`);
    if (error.response?.data) {
      console.error('\nAPI Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.message.includes('DELHIVERY_API_KEY')) {
      printError('\n🔑 API Key Missing!');
      console.log('   Please add DELHIVERY_API_KEY to your .env file');
      console.log('   Get it from: https://one.delhivery.com > Settings > API Setup');
    }
    
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    process.exit(1);
  }
}

// =============================================================================
// Create Sample Test Shipment
// =============================================================================

async function createSampleShipment() {
  printHeader('CREATING SAMPLE TEST SHIPMENT');
  
  console.log('📋 Sample Order Details:');
  console.log(JSON.stringify(sampleOrderData, null, 2));
  console.log('');

  try {
    printInfo('Creating shipment in Delhivery...');
    const result = await delhiveryService.createOrder(sampleOrderData);
    
    if (result && result.success) {
      printSuccess('Sample Shipment Created!');
      console.log(`   Shipment ID: ${result.shipment_id}`);
      console.log(`   Waybill: ${result.waybill}`);
      console.log(`   Order ID: ${result.order_id}`);
      console.log(`   Status: ${result.status}`);

      console.log('\n✨ Next Steps:');
      console.log(`   📍 Track: node scripts/createSampleShipment.js --track ${result.waybill}`);
      console.log(`   🔗 Online: https://www.delhivery.com/track/package/${result.waybill}`);
      console.log(`   📋 Dashboard: https://one.delhivery.com`);
      
      printWarning('\nNote: This is a test shipment. Cancel it in Delhivery dashboard if not needed.');
    } else {
      printError('Failed to create sample shipment');
      console.log('Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    printError(`Failed to create sample shipment: ${error.message}`);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.message.includes('DELHIVERY_API_KEY')) {
      printError('\n🔑 API Key Missing!');
      console.log('   Please add DELHIVERY_API_KEY to your .env file');
      console.log('   Get it from: https://one.delhivery.com > Settings > API Setup');
    }
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  printHeader('🚀 DELHIVERY SHIPMENT CREATOR');
  
  console.log('Usage:');
  console.log('  node scripts/createSampleShipment.js                  # Create test shipment');
  console.log('  node scripts/createSampleShipment.js <orderId>        # Create for real order');
  console.log('  node scripts/createSampleShipment.js --track <waybill> # Track shipment');
  console.log('');

  // Check for tracking request
  const trackIndex = process.argv.indexOf('--track') || process.argv.indexOf('-t');
  if (trackIndex !== -1 && process.argv[trackIndex + 1]) {
    const waybill = process.argv[trackIndex + 1];
    return trackShipment(waybill);
  }

  // Get order ID from command line
  const orderId = process.argv[2];

  if (orderId && !orderId.startsWith('--')) {
    printInfo(`Using order ID: ${orderId}`);
    return createShipmentForOrder(orderId);
  } else {
    printInfo('No order ID provided - creating sample test shipment');
    return createSampleShipment();
  }
}

// Run the script
main()
  .then(() => {
    printSuccess('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    printError('\nUnexpected error:');
    console.error(error);
    process.exit(1);
  });