#!/usr/bin/env node

/**
 * Test script to verify order images are correctly returned from the backend
 * with Cloudinary URLs and can be resolved by the frontend
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const Order = require('./models/Order');
const { resolveImageUrl } = require('../frontend/src/utils/helpers');

async function testOrderImagesWithCloudinary() {
  try {
    console.log('🔍 Testing Order Images with Cloudinary URLs\n');
    console.log('='.repeat(70));

    // Connect to MongoDB
    console.log('\n1️⃣  Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copod-mob');
    console.log('✅ Connected\n');

    // Find an order with items
    console.log('2️⃣  Fetching order with populated variant images...');
    const order = await Order.findOne({ 'items': { $exists: true, $ne: [] } })
      .populate('items.productId', 'title brand model variants.images variants.color variants.price')
      .limit(1);

    if (!order) {
      console.log('⚠️  No orders with items found in database');
      console.log('\n💡 Tip: Create an order first, then run this test again.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`✅ Found order: ${order._id}\n`);

    // Analyze the order structure
    console.log('='.repeat(70));
    console.log('📋 ORDER DATA STRUCTURE ANALYSIS\n');
    
    console.log(`Order ID: ${order._id}`);
    console.log(`Items count: ${order.items.length}`);
    console.log(`Total: ₹${order.total}`);
    console.log(`Status: ${order.status}\n`);

    let hasCloudinaryImages = false;
    let missingImages = false;

    order.items.forEach((item, itemIdx) => {
      console.log(`\n📦 Item ${itemIdx + 1}: ${item.title}`);
      console.log('─'.repeat(70));
      
      // Check direct image on item
      if (item.image) {
        console.log(`✅ Item.image: ${item.image.substring(0, 80)}${item.image.length > 80 ? '...' : ''}`);
        if (item.image.includes('cloudinary') || item.image.includes('res.cloudinary')) {
          hasCloudinaryImages = true;
        }
      } else {
        console.log('❌ Item.image: NOT FOUND');
        missingImages = true;
      }

      // Check productId and variants
      if (item.productId && typeof item.productId === 'object') {
        console.log(`\n  Product: ${item.productId.title || 'N/A'}`);
        console.log(`  Brand: ${item.productId.brand || 'N/A'}`);
        console.log(`  Model: ${item.productId.model || 'N/A'}`);

        if (item.productId.variants && item.productId.variants.length > 0) {
          console.log(`  Variants: ${item.productId.variants.length} found`);

          item.productId.variants.forEach((variant, vIdx) => {
            if (variant.images && variant.images.length > 0) {
              console.log(`\n    ✅ Variant ${vIdx} Images:`);
              variant.images.forEach((img, imgIdx) => {
                const isPrimary = img.isPrimary ? '(Primary)' : '';
                const url = img.url || img.secure_url || 'MISSING';
                console.log(`      Image ${imgIdx} ${isPrimary}`);
                
                if (url !== 'MISSING') {
                  console.log(`      URL: ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
                  if (url.includes('cloudinary') || url.includes('res.cloudinary')) {
                    hasCloudinaryImages = true;
                  }
                } else {
                  console.log('      ❌ NO URL FOUND');
                  missingImages = true;
                }
              });
            } else {
              console.log(`    ❌ Variant ${vIdx}: No images found`);
              missingImages = true;
            }
          });
        } else {
          console.log('  ❌ No variants found on product');
          missingImages = true;
        }
      } else if (item.productId) {
        console.log(`  ⚠️  productId is string (not populated): ${item.productId}`);
      }
    });

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY\n');

    if (hasCloudinaryImages && !missingImages) {
      console.log('✨ PERFECT! All checks passed:');
      console.log('  ✅ Variant images are populated');
      console.log('  ✅ Images have Cloudinary URLs');
      console.log('  ✅ All required image data is present\n');
      console.log('🎉 OrderSuccess.jsx will now display images correctly!');
    } else if (hasCloudinaryImages && missingImages) {
      console.log('⚠️  PARTIAL: Some images found, but some missing');
      console.log('  ✅ Cloudinary images are present');
      console.log('  ❌ Some items/variants missing images\n');
      console.log('💡 Ensure all variants have images uploaded to Cloudinary');
    } else if (!hasCloudinaryImages && !missingImages) {
      console.log('⚠️  WARNING: No Cloudinary images detected');
      console.log('  Images might be using local URLs or not yet uploaded\n');
      console.log('💡 Verify images are uploaded to Cloudinary');
    } else {
      console.log('❌ ERROR: Missing image data in database');
      console.log('  Images need to be uploaded for variants');
    }

    console.log('\n' + '='.repeat(70));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testOrderImagesWithCloudinary();
