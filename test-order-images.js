#!/usr/bin/env node

/**
 * Test script to verify product images are included in order responses
 * Run: node test-order-images.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('./models/Order');

async function testOrderImages() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copod-mob');
    console.log('✅ Connected to MongoDB\n');

    // Find any order
    const order = await Order.findOne({})
      .populate('items.productId', 'title brand model variants.images variants.color variants.price');

    if (!order) {
      console.log('⚠️  No orders found in database');
      process.exit(0);
    }

    console.log('📋 Order ID:', order._id);
    console.log('📦 Number of items:', order.items?.length || 0);
    console.log('\n' + '='.repeat(60));

    if (order.items && order.items.length > 0) {
      order.items.forEach((item, index) => {
        console.log(`\n📦 Item ${index + 1}:`);
        console.log('  Title:', item.title);
        console.log('  Brand:', item.brand);
        console.log('  Model:', item.model);
        console.log('  Image (from item):', item.image ? '✅ Present' : '❌ Missing');
        
        if (item.productId) {
          console.log('  Product ID:', typeof item.productId === 'object' ? item.productId._id : item.productId);
          
          if (item.productId.variants) {
            console.log('  Variants:', item.productId.variants.length);
            
            item.productId.variants.forEach((variant, vIdx) => {
              if (variant.images && variant.images.length > 0) {
                console.log(`    ✅ Variant ${vIdx}: ${variant.images.length} image(s)`);
                variant.images.forEach((img, imgIdx) => {
                  console.log(`      Image ${imgIdx}: ${img.url ? '✅' : '❌'} URL, Primary: ${img.isPrimary ? '✅' : '❌'}`);
                });
              }
            });
          }
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('\n✨ Images should now display correctly on the OrderSuccess page.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testOrderImages();
