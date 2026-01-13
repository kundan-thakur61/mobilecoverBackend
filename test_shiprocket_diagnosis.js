require('dotenv').config();
const shiprocketService = require('./utils/shiprocket');

async function diagnoseShiprocketIssues() {
  console.log('🔍 Shiprocket Integration Diagnosis\n');

  // Check environment variables
  console.log('1️⃣ Environment Variables Check:');
  console.log('   SHIPROCKET_EMAIL:', process.env.SHIPROCKET_EMAIL ? '✅ Set' : '❌ Not set');
  console.log('   SHIPROCKET_PASSWORD:', process.env.SHIPROCKET_PASSWORD ? '✅ Set' : '❌ Not set');
  console.log('   SHIPROCKET_API_BASE_URL:', process.env.SHIPROCKET_API_BASE_URL || 'Using default');

  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    console.log('\n❌ CRITICAL: Shiprocket credentials not configured!');
    console.log('   Please add these to your .env file:');
    console.log('   SHIPROCKET_EMAIL=your-email@example.com');
    console.log('   SHIPROCKET_PASSWORD=your-password');
    return;
  }

  // Test authentication
  console.log('\n2️⃣ Testing Authentication:');
  try {
    const token = await shiprocketService.authenticate();
    console.log('   ✅ Authentication successful');
    console.log('   Token length:', token.length);
  } catch (error) {
    console.log('   ❌ Authentication failed:', error.message);
    console.log('   Check your email/password in Shiprocket dashboard');
    return;
  }

  // Test pickup locations
  console.log('\n3️⃣ Testing Pickup Locations:');
  try {
    const locations = await shiprocketService.getPickupLocations();
    console.log('   ✅ Pickup locations retrieved:', locations.length);
    if (locations.length === 0) {
      console.log('   ⚠️  WARNING: No pickup locations found!');
      console.log('   You need to add a pickup location in Shiprocket dashboard');
    } else {
      console.log('   First location:', locations[0].pickup_location);
    }
  } catch (error) {
    console.log('   ❌ Pickup locations failed:', error.message);
    console.log('   This usually means no pickup locations are configured');
  }

  // Test serviceability
  console.log('\n4️⃣ Testing Serviceability:');
  try {
    const serviceability = await shiprocketService.checkServiceability('400001', '110001', 0, 0.5);
    console.log('   ✅ Serviceability check successful');
    console.log('   Serviceable:', serviceability.serviceable);
    if (serviceability.serviceable) {
      console.log('   Available couriers:', serviceability.data.available_courier_companies?.length || 0);
    }
  } catch (error) {
    console.log('   ❌ Serviceability check failed:', error.message);
  }

  // Test order creation (dry run)
  console.log('\n5️⃣ Testing Order Creation (Dry Run):');
  const testOrder = {
    orderId: `TEST-${Date.now()}`,
    orderDate: new Date().toISOString().split('T')[0],
    pickupLocationId: 1,
    billingCustomerName: 'Test Customer',
    billingAddress: '123 Test Street',
    billingCity: 'Mumbai',
    billingPincode: '400001',
    billingState: 'Maharashtra',
    billingCountry: 'India',
    billingEmail: 'test@example.com',
    billingPhone: '9876543210',
    shippingCustomerName: 'Test Customer',
    shippingAddress: '123 Test Street',
    shippingCity: 'Mumbai',
    shippingPincode: '400001',
    shippingState: 'Maharashtra',
    shippingCountry: 'India',
    shippingEmail: 'test@example.com',
    shippingPhone: '9876543210',
    orderItems: [{
      name: 'Test Product',
      sku: 'TEST-001',
      units: 1,
      selling_price: 100,
      discount: 0,
      tax: 0,
      hsn: '999999'
    }],
    paymentMethod: 'Prepaid',
    subTotal: 100,
    length: 15,
    breadth: 10,
    height: 2,
    weight: 0.15
  };

  try {
    const result = await shiprocketService.createOrder(testOrder);
    console.log('   ✅ Order creation successful');
    console.log('   Order ID:', result.orderId);
    console.log('   Shipment ID:', result.shipmentId);
    console.log('   AWB Code:', result.awbCode);
    console.log('   Is Mock:', result.isMock || false);

    if (result.isMock) {
      console.log('   ⚠️  WARNING: Order was created as MOCK - not real!');
      console.log('   This means the real API failed and fell back to mock mode');
    } else {
      console.log('   🎉 SUCCESS: Real order created in Shiprocket!');
      console.log('   Check your Shiprocket dashboard to see this order');
    }
  } catch (error) {
    console.log('   ❌ Order creation failed:', error.message);
    console.log('   This is expected if pickup locations are not configured');
  }

  console.log('\n📋 DIAGNOSIS SUMMARY:');
  console.log('=====================================');
  console.log('If you see mock responses, your orders are NOT real in Shiprocket.');
  console.log('You need to:');
  console.log('1. Verify your Shiprocket account is active');
  console.log('2. Add at least one pickup location in Shiprocket dashboard');
  console.log('3. Complete KYC if required');
  console.log('4. Check if your account has shipment creation permissions');
  console.log('=====================================\n');
}

diagnoseShiprocketIssues().catch(console.error);
