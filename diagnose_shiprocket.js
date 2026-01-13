require('dotenv').config();

const shiprocketService = require('./utils/shiprocket');

async function diagnoseShiprocket() {
  console.log('🔍 Diagnosing Shiprocket Account Setup...\n');
  
  try {
    // 1. Test Authentication
    console.log('1. Testing Authentication...');
    const authResult = await shiprocketService.authenticate();
    console.log('   ✅ Authentication successful:', authResult !== null);
    
    // 2. Test Pickup Locations
    console.log('\n2. Testing Pickup Locations...');
    try {
      const locations = await shiprocketService.getPickupLocations();
      console.log('   ✅ Pickup locations retrieved:', locations.length, 'found');
      if (locations.length > 0) {
        console.log('   Available locations:');
        locations.forEach(location => {
          console.log(`     - ID: ${location.id}, Name: ${location.pickup_location || location.name}, Address: ${location.address}`);
        });
      }
    } catch (locationError) {
      console.log('   ❌ Error getting pickup locations:', locationError.message);
    }
    
    // 3. Test Serviceability
    console.log('\n3. Testing Serviceability...');
    try {
      const serviceability = await shiprocketService.checkServiceability('400001', '400001');
      console.log('   ✅ Serviceability check completed:', serviceability.success);
    } catch (serviceabilityError) {
      console.log('   ❌ Error checking serviceability:', serviceabilityError.message);
    }
    
    // 4. Test Account Profile
    console.log('\n4. Testing Account Information...');
    try {
      const profileResponse = await shiprocketService.request('GET', '/settings/profile');
      console.log('   ✅ Profile data retrieved:', !!profileResponse);
    } catch (profileError) {
      console.log('   ❌ Error getting profile:', profileError.message);
    }
    
    // 5. Test Company Settings
    console.log('\n5. Testing Company Settings...');
    try {
      const companyResponse = await shiprocketService.request('GET', '/settings/company');
      console.log('   ✅ Company settings retrieved:', !!companyResponse);
    } catch (companyError) {
      console.log('   ❌ Error getting company settings:', companyError.message);
    }
    
    console.log('\n📋 Summary:');
    console.log('- Check if your Shiprocket account is activated');
    console.log('- Verify KYC documents are submitted and approved');
    console.log('- Ensure payment methods are added to your Shiprocket account');
    console.log('- Confirm your pickup location is properly set up and active');
    console.log('- Check if there are any pending verifications in your Shiprocket dashboard');
    
  } catch (error) {
    console.log('\n❌ Overall diagnosis failed:', error.message);
  }
}

// Run the diagnosis
diagnoseShiprocket().catch(console.error);