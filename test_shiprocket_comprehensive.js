require('dotenv').config();
const shiprocketService = require('./utils/shiprocket');

async function runComprehensiveShiprocketTests() {
  console.log('🚀 Comprehensive Shiprocket Integration Testing\n');
  console.log('='.repeat(60));

  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Helper function to log test results
  function logTest(name, success, message = '', isWarning = false) {
    testResults.total++;
    const status = success ? '✅ PASS' : (isWarning ? '⚠️  WARN' : '❌ FAIL');
    console.log(`${status} ${name}`);
    if (message) console.log(`   ${message}`);

    if (success) testResults.passed++;
    else if (isWarning) testResults.warnings++;
    else testResults.failed++;

    console.log('');
  }

  // 1. Environment Configuration Test
  console.log('1️⃣  ENVIRONMENT CONFIGURATION');
  console.log('-'.repeat(30));

  const emailSet = !!process.env.SHIPROCKET_EMAIL;
  const passwordSet = !!process.env.SHIPROCKET_PASSWORD;
  const apiUrl = process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';

  logTest('SHIPROCKET_EMAIL configured', emailSet);
  logTest('SHIPROCKET_PASSWORD configured', passwordSet);
  logTest('SHIPROCKET_API_BASE_URL configured', !!process.env.SHIPROCKET_API_BASE_URL,
    `Using: ${apiUrl}`);

  if (!emailSet || !passwordSet) {
    console.log('❌ Cannot proceed without credentials. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env\n');
    return;
  }

  // 2. Authentication Test
  console.log('2️⃣  AUTHENTICATION');
  console.log('-'.repeat(30));

  try {
    const token = await shiprocketService.authenticate();
    logTest('Authentication successful', true, `Token length: ${token.length}`);
  } catch (error) {
    logTest('Authentication failed', false, error.message);
    return;
  }

  // 3. Pickup Locations Test
  console.log('3️⃣  PICKUP LOCATIONS');
  console.log('-'.repeat(30));

  try {
    const locations = await shiprocketService.getPickupLocations();
    const hasLocations = locations && locations.length > 0;
    logTest('Pickup locations retrieved', true, `Found ${locations.length} locations`);

    if (hasLocations) {
      locations.forEach((loc, index) => {
        console.log(`   ${index + 1}. ${loc.pickup_location} (${loc.city}, ${loc.state})`);
      });
    } else {
      logTest('Pickup locations available', false, 'No pickup locations found - this will prevent order creation', true);
    }
  } catch (error) {
    logTest('Pickup locations failed', false, error.message);
  }

  // 4. Serviceability Test
  console.log('4️⃣  SERVICEABILITY CHECK');
  console.log('-'.repeat(30));

  const testRoutes = [
    { pickup: '400001', delivery: '110001', desc: 'Mumbai → Delhi' },
    { pickup: '400001', delivery: '560001', desc: 'Mumbai → Bangalore' },
    { pickup: '110001', delivery: '400001', desc: 'Delhi → Mumbai' }
  ];

  for (const route of testRoutes) {
    try {
      const result = await shiprocketService.checkServiceability(route.pickup, route.delivery, 0, 0.5);
      const serviceable = result.serviceable;
      const courierCount = result.data?.available_courier_companies?.length || 0;

      logTest(`Serviceability ${route.desc}`, serviceable,
        `Serviceable: ${serviceable}, Couriers: ${courierCount}`);

      if (serviceable && courierCount > 0) {
        const topCouriers = result.data.available_courier_companies.slice(0, 2);
        topCouriers.forEach(courier => {
          console.log(`   • ${courier.courier_name}: ₹${courier.rate} (${courier.etd} days)`);
        });
      }
    } catch (error) {
      logTest(`Serviceability ${route.desc}`, false, error.message);
    }
  }

  // 5. Order Creation Test
  console.log('5️⃣  ORDER CREATION');
  console.log('-'.repeat(30));

  const testOrder = {
    orderId: `TEST-${Date.now()}`,
    orderDate: new Date().toISOString().split('T')[0],
    pickupLocationId: 1,
    billingCustomerName: 'Test Customer',
    billingAddress: '123 Test Street, Near Main Market',
    billingCity: 'Mumbai',
    billingPincode: '400001',
    billingState: 'Maharashtra',
    billingCountry: 'India',
    billingEmail: 'test@example.com',
    billingPhone: '9876543210',
    shippingCustomerName: 'Test Customer',
    shippingAddress: '123 Test Street, Near Main Market',
    shippingCity: 'Mumbai',
    shippingPincode: '400001',
    shippingState: 'Maharashtra',
    shippingCountry: 'India',
    shippingEmail: 'test@example.com',
    shippingPhone: '9876543210',
    orderItems: [{
      name: 'Premium Mobile Cover',
      sku: 'TEST-001',
      units: 1,
      selling_price: 299,
      discount: 0,
      tax: 0,
      hsn: '39269099'
    }],
    paymentMethod: 'Prepaid',
    subTotal: 299,
    length: 15,
    breadth: 10,
    height: 2,
    weight: 0.15
  };

  try {
    const orderResult = await shiprocketService.createOrder(testOrder);

    // Check if it's a mock response
    const isMock = orderResult.isMock || !orderResult.orderId;
    logTest('Order creation attempt', !isMock,
      isMock ? 'Order created as MOCK (not real)' : 'Real order created');

    if (!isMock) {
      logTest('Order ID returned', !!orderResult.orderId, `Order ID: ${orderResult.orderId}`);
      logTest('Shipment ID returned', !!orderResult.shipmentId, `Shipment ID: ${orderResult.shipmentId}`);
      logTest('AWB Code returned', !!orderResult.awbCode, `AWB Code: ${orderResult.awbCode}`);

      if (orderResult.orderId) {
        console.log('\n🎉 SUCCESS: Real order created in Shiprocket!');
        console.log('📋 Order Details:');
        console.log(`   • Order ID: ${orderResult.orderId}`);
        console.log(`   • Shipment ID: ${orderResult.shipmentId}`);
        console.log(`   • AWB Code: ${orderResult.awbCode}`);
        console.log(`   • Status: ${orderResult.status || 'Created'}`);
        console.log('\n🔍 Check your Shiprocket dashboard to verify this order appears.');
      }
    } else {
      logTest('Mock order prevention', false, 'Order was created as mock - check pickup locations', true);
    }
  } catch (error) {
    logTest('Order creation failed', false, error.message);
  }

  // 6. Tracking Test (if order was created)
  console.log('6️⃣  TRACKING TEST');
  console.log('-'.repeat(30));

  // This would require a real AWB code from a successful order
  logTest('Tracking test', false, 'Skipped - requires real AWB code from successful order', true);

  // 7. Summary
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings}`);

  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);

  console.log('\n📋 RECOMMENDATIONS:');
  console.log('='.repeat(60));

  if (testResults.failed > 0) {
    console.log('❌ Critical Issues Found:');
    if (!emailSet || !passwordSet) {
      console.log('   • Configure SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env');
    }
    console.log('   • Add pickup location in Shiprocket dashboard');
    console.log('   • Verify account is active and KYC completed');
  }

  if (testResults.warnings > 0) {
    console.log('⚠️  Warnings:');
    console.log('   • Some features may work but are using mock data');
    console.log('   • Orders may not appear in Shiprocket dashboard');
  }

  if (testResults.failed === 0 && testResults.warnings === 0) {
    console.log('🎉 All tests passed! Shiprocket integration is working correctly.');
    console.log('   • Orders should appear in Shiprocket dashboard');
    console.log('   • Tracking should work properly');
    console.log('   • All API endpoints are functioning');
  }

  console.log('\n🔄 Next Steps:');
  console.log('   1. Fix any failed tests');
  console.log('   2. Create a real order through your application');
  console.log('   3. Verify it appears in Shiprocket dashboard');
  console.log('   4. Test tracking functionality');

  console.log('\n' + '='.repeat(60));
}

runComprehensiveShiprocketTests().catch(console.error);
