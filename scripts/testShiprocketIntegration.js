/**
 * Test Shiprocket Integration
 * 
 * This script tests the complete Shiprocket API integration.
 * Run: node scripts/testShiprocketIntegration.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const shiprocketService = require('../utils/shiprocket');
const logger = require('../utils/logger');

async function testShiprocketIntegration() {
  console.log('\n🧪 Testing Shiprocket Integration...\n');
  
  try {
    // Test 1: Authentication
    console.log('1️⃣  Testing Authentication...');
    const token = await shiprocketService.authenticate();
    if (token) {
      console.log('   ✅ Authentication successful!');
      console.log(`   Token: ${token.substring(0, 20)}...`);
    } else {
      console.log('   ❌ Authentication failed - check credentials');
      return;
    }

    // Test 2: Get Pickup Locations
    console.log('\n2️⃣  Fetching Pickup Locations...');
    const locations = await shiprocketService.getPickupLocations();
    if (locations && locations.length > 0) {
      console.log('   ✅ Pickup locations found:');
      locations.forEach((loc, index) => {
        console.log(`      ${index + 1}. ${loc.pickup_location} - ${loc.city}, ${loc.state}`);
      });
    } else {
      console.log('   ⚠️  No pickup locations found. Add one in Shiprocket dashboard.');
    }

    // Test 3: Check Serviceability (Mumbai to Delhi)
    console.log('\n3️⃣  Testing Serviceability Check (Mumbai 400001 → Delhi 110001)...');
    const serviceability = await shiprocketService.checkServiceability(
      '400001', // Mumbai
      '110001', // Delhi
      0,        // Prepaid (no COD)
      0.5       // 0.5 kg weight
    );
    
    if (serviceability.data?.available_courier_companies?.length > 0) {
      console.log('   ✅ Delivery is serviceable!');
      console.log(`   Available Couriers: ${serviceability.data.available_courier_companies.length}`);
      console.log('   Top 3 couriers by price:');
      
      const sortedCouriers = serviceability.data.available_courier_companies
        .sort((a, b) => a.freight_charge - b.freight_charge)
        .slice(0, 3);
      
      sortedCouriers.forEach((courier, index) => {
        console.log(`      ${index + 1}. ${courier.courier_name} - ₹${courier.freight_charge} (${courier.estimated_delivery_days})`);
      });
    } else {
      console.log('   ⚠️  No couriers available for this route');
    }

    // Test 4: Get recommended couriers
    console.log('\n4️⃣  Testing Recommended Couriers...');
    const recommendedCouriers = await shiprocketService.getRecommendedCouriers(
      '400001', // Mumbai
      '110001', // Delhi
      0,        // Prepaid (no COD)
      0.5       // 0.5 kg weight
    );
    
    if (recommendedCouriers.couriers && recommendedCouriers.couriers.length > 0) {
      console.log('   ✅ Recommended couriers retrieved:');
      recommendedCouriers.couriers.slice(0, 3).forEach((courier, index) => {
        console.log(`      ${index + 1}. ${courier.courier_name} - ₹${courier.freight_charge} (${courier.etd})`);
      });
    } else {
      console.log('   ⚠️  No recommended couriers found');
    }

    console.log('\n✅ All basic tests completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Add pickup location in Shiprocket dashboard if not already added');
    console.log('   2. Create a test order through your application');
    console.log('   3. Use the admin API to create a shipment for that order');
    console.log('   4. Monitor the logs for successful shipment creation\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('   API Response:', error.response.data);
    }
    
    console.log('\n🔍 Troubleshooting:');
    console.log('   - Verify SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env');
    console.log('   - Check if your Shiprocket account is active');
    console.log('   - Ensure KYC is completed in Shiprocket dashboard');
    console.log('   - Check API documentation: https://apidocs.shiprocket.in/\n');
  }
}

// Run the test
testShiprocketIntegration().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});