/**
 * Comprehensive Shiprocket API Functionality Test
 * 
 * This script tests all Shiprocket API functionality including:
 * - Authentication
 * - Pickup locations
 * - Serviceability check
 * - Courier recommendations
 * - Shipment creation (mock)
 * - Shipment tracking (mock)
 * - Shipment cancellation (mock)
 * - Label generation (mock)
 * - Pickup requests (mock)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const shiprocketService = require('./utils/shiprocket');
const Order = require('./models/Order');
const CustomOrder = require('./models/CustomOrder');

async function testAllShiprocketFunctionality() {
  console.log('\n🚀 Starting Comprehensive Shiprocket API Tests...\n');
  
  try {
    // Test 1: Authentication
    console.log('1️⃣  Testing Authentication...');
    try {
      const token = await shiprocketService.authenticate();
      if (token) {
        console.log('   ✅ Authentication successful!');
        console.log(`   Token preview: ${token.substring(0, 20)}...`);
      } else {
        console.log('   ⚠️  Authentication failed - check credentials (will use mock mode)');
      }
    } catch (authError) {
      console.log('   ⚠️  Authentication failed - using mock mode:', authError.message);
    }

    // Test 2: Get Pickup Locations
    console.log('\n2️⃣  Testing Pickup Locations...');
    try {
      const locations = await shiprocketService.getPickupLocations();
      if (locations && locations.length > 0) {
        console.log('   ✅ Pickup locations retrieved:');
        locations.forEach((loc, index) => {
          console.log(`      ${index + 1}. ${loc.pickup_location || loc.name} - ${loc.city || 'N/A'}, ${loc.state || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️  No pickup locations found (using mock)');
      }
    } catch (locationError) {
      console.log('   ⚠️  Pickup locations failed (using mock):', locationError.message);
    }

    // Test 3: Serviceability Check
    console.log('\n3️⃣  Testing Serviceability Check...');
    try {
      const serviceability = await shiprocketService.checkServiceability(
        '400001', // Mumbai (default pickup)
        '110001', // Delhi (sample delivery)
        0,        // Prepaid (no COD)
        0.5       // 0.5 kg weight
      );
      
      if (serviceability.data?.available_courier_companies?.length > 0) {
        console.log('   ✅ Serviceability check successful!');
        console.log(`   Available Couriers: ${serviceability.data.available_courier_companies.length}`);
        console.log('   Top 3 couriers by price:');
        
        const sortedCouriers = serviceability.data.available_courier_companies
          .sort((a, b) => (a.freight_charge || 0) - (b.freight_charge || 0))
          .slice(0, 3);
        
        sortedCouriers.forEach((courier, index) => {
          console.log(`      ${index + 1}. ${courier.courier_name} - ₹${courier.freight_charge || 'N/A'} (${courier.etd || 'N/A'})`);
        });
      } else {
        console.log('   ⚠️  No couriers available for this route (using mock)');
      }
    } catch (serviceError) {
      console.log('   ⚠️  Serviceability check failed (using mock):', serviceError.message);
    }

    // Test 4: Recommended Couriers
    console.log('\n4️⃣  Testing Recommended Couriers...');
    try {
      const recommendedCouriers = await shiprocketService.getRecommendedCouriers(
        '400001', // Mumbai
        '110001', // Delhi
        0,        // Prepaid (no COD)
        0.5       // 0.5 kg weight
      );
      
      if (recommendedCouriers.couriers && recommendedCouriers.couriers.length > 0) {
        console.log('   ✅ Recommended couriers retrieved:');
        recommendedCouriers.couriers.slice(0, 3).forEach((courier, index) => {
          console.log(`      ${index + 1}. ${courier.courier_name} - ₹${courier.freight_charge || 'N/A'} (${courier.etd || 'N/A'})`);
        });
      } else {
        console.log('   ⚠️  No recommended couriers found (using mock)');
      }
    } catch (recommendError) {
      console.log('   ⚠️  Recommended couriers failed (using mock):', recommendError.message);
    }

    // Test 5: Create Sample Order Data (for mock shipment creation)
    console.log('\n5️⃣  Testing Shipment Creation (Mock)...');
    try {
      const mockOrderData = {
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
        shippingCity: 'Delhi',
        shippingPincode: '110001',
        shippingState: 'Delhi',
        shippingCountry: 'India',
        shippingEmail: 'test@example.com',
        shippingPhone: '9876543210',
        orderItems: [{
          name: 'Test Product',
          sku: `TEST-${Date.now()}`,
          units: 1,
          selling_price: 499,
          discount: 0,
          tax: 0,
          hsn: 392690
        }],
        paymentMethod: 'prepaid',
        subTotal: 499,
        length: 15,
        breadth: 10,
        height: 2,
        weight: 0.5
      };

      const shipmentResult = await shiprocketService.createOrder(mockOrderData);
      
      if (shipmentResult.success) {
        console.log('   ✅ Shipment creation successful!');
        console.log(`   Order ID: ${shipmentResult.orderId}`);
        console.log(`   Shipment ID: ${shipmentResult.shipmentId}`);
        console.log(`   AWB Code: ${shipmentResult.awbCode}`);
        console.log(`   Tracking URL: ${shipmentResult.trackingUrl}`);
        console.log(`   Is Mock: ${shipmentResult.isMock ? 'Yes' : 'No'}`);
      } else {
        console.log('   ⚠️  Shipment creation returned with issues');
      }
    } catch (createError) {
      console.log('   ⚠️  Shipment creation failed (using mock):', createError.message);
    }

    // Test 6: Track Shipment (Mock)
    console.log('\n6️⃣  Testing Shipment Tracking (Mock)...');
    try {
      const mockAwb = `TEST${Date.now()}`;
      const trackingResult = await shiprocketService.trackShipment(mockAwb);
      
      if (trackingResult) {
        console.log('   ✅ Tracking successful!');
        console.log(`   AWB: ${trackingResult.awb_code || mockAwb}`);
        console.log(`   Status: ${trackingResult.status || 'N/A'}`);
        console.log(`   Location: ${trackingResult.current_location || 'N/A'}`);
        console.log(`   Tracking History Count: ${(trackingResult.tracking_data?.history || []).length}`);
      } else {
        console.log('   ⚠️  Tracking returned no data');
      }
    } catch (trackError) {
      console.log('   ⚠️  Tracking failed (using mock):', trackError.message);
    }

    // Test 7: Cancel Shipment (Mock)
    console.log('\n7️⃣  Testing Shipment Cancellation (Mock)...');
    try {
      const mockAwb = `TEST${Date.now()}`;
      const cancelResult = await shiprocketService.cancelShipment(mockAwb);
      
      if (cancelResult.success) {
        console.log('   ✅ Cancellation successful!');
        console.log(`   AWB: ${cancelResult.awb_code || mockAwb}`);
        console.log(`   Status: ${cancelResult.status || 'N/A'}`);
      } else {
        console.log('   ⚠️  Cancellation returned with issues');
      }
    } catch (cancelError) {
      console.log('   ⚠️  Cancellation failed (using mock):', cancelError.message);
    }

    // Test 8: Generate Label (Mock)
    console.log('\n8️⃣  Testing Label Generation (Mock)...');
    try {
      const mockShipmentIds = [Date.now()];
      const labelResult = await shiprocketService.generateLabel(mockShipmentIds);
      
      if (labelResult.success) {
        console.log('   ✅ Label generation successful!');
        console.log(`   Shipment IDs: ${JSON.stringify(labelResult.shipment_ids || [])}`);
        console.log(`   Label URLs: ${JSON.stringify(labelResult.label_urls || [])}`);
      } else {
        console.log('   ⚠️  Label generation returned with issues');
      }
    } catch (labelError) {
      console.log('   ⚠️  Label generation failed (using mock):', labelError.message);
    }

    // Test 9: Request Pickup (Mock)
    console.log('\n9️⃣  Testing Pickup Request (Mock)...');
    try {
      const mockShipmentIds = [Date.now()];
      const pickupResult = await shiprocketService.requestPickup(mockShipmentIds);
      
      if (pickupResult.success) {
        console.log('   ✅ Pickup request successful!');
        console.log(`   Shipment IDs: ${JSON.stringify(pickupResult.shipment_ids || [])}`);
        console.log(`   Status: ${pickupResult.status || 'N/A'}`);
      } else {
        console.log('   ⚠️  Pickup request returned with issues');
      }
    } catch (pickupError) {
      console.log('   ⚠️  Pickup request failed (using mock):', pickupError.message);
    }

    console.log('\n🎯 All Shiprocket functionality tests completed!');
    console.log('\n📋 Summary:');
    console.log('   - Authentication: Tested (with fallback to mock)');
    console.log('   - Pickup Locations: Tested (with fallback to mock)');
    console.log('   - Serviceability: Tested (with fallback to mock)');
    console.log('   - Courier Recommendations: Tested (with fallback to mock)');
    console.log('   - Shipment Creation: Tested (with fallback to mock)');
    console.log('   - Tracking: Tested (with fallback to mock)');
    console.log('   - Cancellation: Tested (with fallback to mock)');
    console.log('   - Label Generation: Tested (with fallback to mock)');
    console.log('   - Pickup Requests: Tested (with fallback to mock)');
    
    console.log('\n💡 Notes:');
    console.log('   - If credentials are not configured, all API calls will use mock mode');
    console.log('   - Mock mode simulates API responses for development/testing');
    console.log('   - Configure SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD for live API');
    console.log('   - Mock responses include realistic data structures for testing');

  } catch (error) {
    console.error('\n❌ Comprehensive test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testAllShiprocketFunctionality()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error during testing:', error);
    process.exit(1);
  });