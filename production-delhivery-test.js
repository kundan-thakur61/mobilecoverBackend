require('dotenv').config();
const delhiveryService = require('./utils/deliveryOne');
const mongoose = require('mongoose');
const Order = require('./models/Order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function testProductionDelhiverySetup() {
  console.log('🚀 PRODUCTION DELHIVERY SETUP TEST');
  console.log('===================================');
  
  // Check environment configuration
  console.log('\n🔧 Environment Configuration:');
  console.log(`   API Key: ${process.env.DELHIVERY_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   Base URL: ${process.env.DELHIVERY_API_BASE_URL || 'DEFAULT'}`);
  console.log(`   Webhook Token: ${process.env.DELHIVERY_WEBHOOK_TOKEN ? 'SET' : 'NOT SET'}`);
  console.log(`   Pickup Location: ${process.env.DELHIVERY_PICKUP_LOCATION || 'NOT SET'}`);
  console.log(`   Pickup Pincode: ${process.env.DELHIVERY_PICKUP_PINCODE || 'NOT SET'}`);
  console.log(`   Company Name: ${process.env.DELHIVERY_COMPANY_NAME || 'NOT SET'}`);

  await mongoose.connect(MONGODB_URI);
  console.log('\n✅ Database connected');

  // Test 1: Create real shipment with production-like data
  console.log('\n📦 Test 1: Real Shipment Creation');
  try {
    const testOrderData = {
      orderId: `PROD-TEST-${Date.now()}`,
      orderDate: new Date().toISOString().split('T')[0],
      pickupLocation: process.env.DELHIVERY_PICKUP_LOCATION || 'Primary',
      billingCustomerName: 'Test Customer',
      billingLastName: 'Production',
      billingAddress: '123 Production Test Street',
      billingAddress2: 'Near Test Landmark',
      billingCity: 'Mumbai',
      billingPincode: '400001',
      billingState: 'Maharashtra',
      billingCountry: 'India',
      billingEmail: 'test@production.com',
      billingPhone: '9876543210',
      shippingIsBilling: true,
      orderItems: [{
        name: 'Premium Mobile Cover',
        sku: 'PMC-001',
        units: 1,
        selling_price: 299,
        discount: 0,
        tax: 0,
        hsn: 392690
      }],
      paymentMethod: 'Prepaid',
      subTotal: 299,
      length: 15,
      breadth: 10,
      height: 2,
      weight: 0.15
    };

    console.log('   Creating shipment with production data...');
    const createResult = await delhiveryService.createOrder(testOrderData);
    
    console.log('✅ Shipment Creation Result:');
    console.log(`   Success: ${createResult.success}`);
    console.log(`   Shipment ID: ${createResult.shipment_id}`);
    console.log(`   Waybill: ${createResult.waybill}`);
    console.log(`   Status: ${createResult.status}`);

    if (createResult.success && createResult.waybill) {
      // Test 2: Track the created shipment
      console.log('\n📍 Test 2: Track Created Shipment');
      try {
        const trackResult = await delhiveryService.trackShipment(createResult.waybill);
        console.log('✅ Tracking Result:');
        console.log(`   Has ShipmentData: ${!!trackResult.ShipmentData}`);
        
        if (trackResult.ShipmentData && trackResult.ShipmentData.length > 0) {
          const shipment = trackResult.ShipmentData[0].Shipment;
          console.log(`   Current Status: ${shipment.Status?.Status}`);
          console.log(`   Location: ${shipment.Status?.StatusLocation}`);
          console.log(`   Status Date: ${shipment.Status?.StatusDateTime}`);
        }
      } catch (trackError) {
        console.log('❌ Tracking failed:', trackError.message);
      }

      // Test 3: Create database order with shipment
      console.log('\n💾 Test 3: Database Order with Shipment');
      try {
        const testOrder = new Order({
          userId: null, // Guest order
          guestEmail: 'test@production.com',
          items: [{
            productId: 'PROD-TEST-001',
            variantId: 'PMC-001',
            title: 'Premium Mobile Cover',
            brand: 'Test Brand',
            price: 299,
            quantity: 1
          }],
          total: 299,
          status: 'confirmed',
          shippingAddress: {
            name: 'Test Customer Production',
            phone: '9876543210',
            address1: '123 Production Test Street',
            address2: 'Near Test Landmark',
            city: 'Mumbai',
            state: 'Maharashtra',
            postalCode: '400001',
            country: 'India'
          },
          payment: {
            method: 'razorpay',
            status: 'paid',
            paidAt: new Date(),
            amount: 299
          },
          deliveryOne: {
            shipmentId: createResult.shipment_id,
            waybill: createResult.waybill,
            awbCode: createResult.waybill,
            orderId: testOrderData.orderId,
            status: createResult.status,
            statusCode: createResult.status,
            lastSyncedAt: new Date(),
            remarks: 'Production test shipment'
          },
          trackingNumber: createResult.waybill
        });

        await testOrder.save();
        console.log('✅ Test order created in database');
        console.log(`   Order ID: ${testOrder._id}`);
        console.log(`   Waybill: ${testOrder.deliveryOne.waybill}`);
        console.log(`   Status: ${testOrder.status}`);

        // Test 4: Simulate webhook updates
        console.log('\n🪝 Test 4: Simulate Production Webhook Updates');
        
        // Simulate In Transit
        const inTransitWebhook = {
          waybill: createResult.waybill,
          order: testOrderData.orderId,
          status: 'In Transit',
          current_status: 'In Transit',
          location: 'Mumbai Sorting Facility',
          instructions: 'Package processed at sorting facility'
        };

        console.log('   Simulating In Transit webhook...');
        // This would normally be called by Delhivery
        testOrder.deliveryOne.status = 'In Transit';
        testOrder.status = 'shipped';
        testOrder.deliveryOne.lastSyncedAt = new Date();
        
        if (!testOrder.deliveryOne.trackingData) {
          testOrder.deliveryOne.trackingData = {};
        }
        testOrder.deliveryOne.trackingData.currentStatus = 'In Transit';
        testOrder.deliveryOne.trackingData.statusLocation = 'Mumbai Sorting Facility';
        testOrder.deliveryOne.trackingData.statusDateTime = new Date();
        
        await testOrder.save();
        console.log('✅ In Transit status applied');

        // Simulate Delivered
        console.log('   Simulating Delivered webhook...');
        testOrder.deliveryOne.status = 'Delivered';
        testOrder.status = 'delivered';
        testOrder.deliveryOne.deliveredDate = new Date();
        testOrder.deliveryOne.lastSyncedAt = new Date();
        
        testOrder.deliveryOne.trackingData.currentStatus = 'Delivered';
        testOrder.deliveryOne.trackingData.statusLocation = 'Customer Address';
        testOrder.deliveryOne.trackingData.statusDateTime = new Date();
        
        await testOrder.save();
        console.log('✅ Delivered status applied');
        console.log(`   Final Order Status: ${testOrder.status}`);
        console.log(`   Final DeliveryOne Status: ${testOrder.deliveryOne.status}`);
        console.log(`   Delivered Date: ${testOrder.deliveryOne.deliveredDate}`);

      } catch (dbError) {
        console.log('❌ Database operations failed:', dbError.message);
      }
    }

  } catch (createError) {
    console.log('❌ Shipment creation failed:', createError.message);
    console.log('   This is expected with test credentials');
  }

  // Test 5: Serviceability check
  console.log('\n🔍 Test 5: Serviceability Check');
  try {
    const serviceResult = await delhiveryService.checkServiceability(
      process.env.DELHIVERY_PICKUP_PINCODE || '400001',
      '110001', // Delhi
      0, // Prepaid
      0.5 // Weight
    );
    
    console.log('✅ Serviceability Result:');
    console.log(`   Serviceable: ${serviceResult.serviceable}`);
    console.log(`   Prepaid Available: ${serviceResult.data?.prepaid}`);
    console.log(`   COD Available: ${serviceResult.data?.cod}`);
    console.log(`   Pickup Available: ${serviceResult.data?.pickup}`);
    console.log(`   Is Mock: ${serviceResult.isMock || false}`);

  } catch (serviceError) {
    console.log('❌ Serviceability check failed:', serviceError.message);
  }

  // Test 6: Pickup locations
  console.log('\n🏢 Test 6: Pickup Locations');
  try {
    const locations = await delhiveryService.getPickupLocations();
    console.log('✅ Pickup Locations Result:');
    console.log(`   Count: ${locations.length}`);
    if (locations.length > 0) {
      console.log(`   First Location: ${locations[0].name} (${locations[0].city})`);
    }
  } catch (locationsError) {
    console.log('❌ Pickup locations failed:', locationsError.message);
  }

  console.log('\n🎯 PRODUCTION TEST COMPLETE');
  console.log('\n📋 PRODUCTION READINESS CHECKLIST:');
  
  const checks = [
    { name: 'API Key Configured', status: !!process.env.DELHIVERY_API_KEY },
    { name: 'Base URL Set', status: !!process.env.DELHIVERY_API_BASE_URL },
    { name: 'Webhook Token Set', status: !!process.env.DELHIVERY_WEBHOOK_TOKEN },
    { name: 'Pickup Location Set', status: !!process.env.DELHIVERY_PICKUP_LOCATION },
    { name: 'Pickup Pincode Set', status: !!process.env.DELHIVERY_PICKUP_PINCODE },
    { name: 'Company Name Set', status: !!process.env.DELHIVERY_COMPANY_NAME }
  ];

  checks.forEach(check => {
    console.log(`   ${check.status ? '✅' : '❌'} ${check.name}`);
  });

  const allConfigured = checks.every(check => check.status);
  console.log(`\n🚀 Production Ready: ${allConfigured ? 'YES' : 'NO'}`);

  if (!allConfigured) {
    console.log('\n⚠️  Missing Configuration - Update .env file:');
    console.log('   DELHIVERY_API_KEY=your_production_api_key');
    console.log('   DELHIVERY_API_BASE_URL=https://track.delhivery.com');
    console.log('   DELHIVERY_WEBHOOK_TOKEN=your_webhook_secret');
    console.log('   DELHIVERY_PICKUP_LOCATION=Primary');
    console.log('   DELHIVERY_PICKUP_PINCODE=400001');
    console.log('   DELHIVERY_COMPANY_NAME=Your Company Name');
  }

  await mongoose.connection.close();
}

testProductionDelhiverySetup().catch(error => {
  console.error('❌ Production test failed:', error);
});
