#!/usr/bin/env node

/**
 * Verify the image fix by checking the API query structure
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying the order image fix...\n');

const orderControllerPath = path.join(__dirname, 'controllers/orderController.js');
const content = fs.readFileSync(orderControllerPath, 'utf8');

// Check for the three populate statements with variants.images
const populateChecks = [
  { name: 'getMyOrders', pattern: /getMyOrders[\s\S]*?\.populate\('items\.productId',\s*'[^']*variants\.images[^']*'\)/ },
  { name: 'getOrder', pattern: /const getOrder[\s\S]*?\.populate\('items\.productId',\s*'[^']*variants\.images[^']*'\)/ },
  { name: 'getAllOrders', pattern: /getAllOrders[\s\S]*?\.populate\('items\.productId',\s*'[^']*variants\.images[^']*'\)/ }
];

let allFixed = true;

console.log('Checking populate queries:\n');
populateChecks.forEach(check => {
  if (check.pattern.test(content)) {
    console.log(`✅ ${check.name}: variants.images included`);
  } else {
    console.log(`❌ ${check.name}: variants.images NOT found`);
    allFixed = false;
  }
});

console.log('\n' + '='.repeat(60));

if (allFixed) {
  console.log('\n✨ SUCCESS! All populate queries have been updated.');
  console.log('\n📝 Summary of changes:');
  console.log('  • getMyOrders: Now populates variants.images');
  console.log('  • getOrder: Now populates variants.images');
  console.log('  • getAllOrders: Now populates variants.images');
  console.log('\n🎯 Expected Result:');
  console.log('  Product images will now display correctly on the order success page');
  console.log('  and in the orders list, since variant image data is included in the API response.');
  process.exit(0);
} else {
  console.log('\n❌ Some queries are still missing variants.images');
  process.exit(1);
}
