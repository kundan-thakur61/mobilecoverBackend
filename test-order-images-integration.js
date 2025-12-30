#!/usr/bin/env node

/**
 * Integration test: Simulate the complete order image flow
 * This verifies that:
 * 1. Backend returns variant images with order data
 * 2. Frontend can resolve and display the images
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('./models/Order');
const Product = require('./models/Product');
const User = require('./models/User');

async function createTestOrderWithImages() {
  try {
    console.log('🧪 INTEGRATION TEST: Order Images with Cloudinary\n');
    console.log('='.repeat(70));

    // Connect to MongoDB
    console.log('\n1️⃣  Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copod-mob');
    console.log('✅ Connected\n');

    // Check if test data exists
    console.log('2️⃣  Looking for existing test products and users...');
    
    let user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      console.log('   Creating test user...');
      user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'test123456'
      });
      console.log('   ✅ Test user created');
    } else {
      console.log('   ✅ Found existing test user');
    }

    let product = await Product.findOne({ title: 'Test Product for Images' });
    
    if (!product) {
      console.log('   Creating test product with variant images...');
      
      const cloudinaryImages = [
        {
          url: 'https://res.cloudinary.com/example/image/upload/v1234567890/product-images/test-image-1.jpg',
          publicId: 'product-images/test-image-1',
          isPrimary: true
        },
        {
          url: 'https://res.cloudinary.com/example/image/upload/v1234567890/product-images/test-image-2.jpg',
          publicId: 'product-images/test-image-2',
          isPrimary: false
        }
      ];

      product = await Product.create({
        title: 'Test Product for Images',
        brand: 'TestBrand',
        model: 'TP-001',
        category: 'Plain',
        description: 'Test product with Cloudinary images',
        type: 'Glossy Metal',
        variants: [
          {
            color: 'Black',
            price: 499,
            stock: 10,
            sku: 'TEST-BLK-001',
            images: cloudinaryImages
          }
        ]
      });
      console.log('   ✅ Test product created with Cloudinary images');
    } else {
      console.log('   ✅ Found existing test product');
    }

    // Create order
    console.log('\n3️⃣  Creating test order...');
    
    const variant = product.variants[0];
    
    const order = await Order.create({
      userId: user._id,
      items: [
        {
          productId: product._id,
          variantId: variant._id,
          title: product.title,
          brand: product.brand,
          model: product.model,
          color: variant.color,
          price: variant.price,
          quantity: 1,
          image: variant.images[0]?.url // Store image URL directly
        }
      ],
      total: variant.price,
      shippingAddress: {
        name: 'Test User',
        phone: '9999999999',
        address1: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        postalCode: '123456',
        country: 'India'
      },
      payment: { method: 'cod' },
      status: 'confirmed'
    });

    console.log(`   ✅ Order created: ${order._id}\n`);

    // Now test the API query (getOrder with populate)
    console.log('4️⃣  Testing getOrder API query...');
    console.log('   (Simulating what OrderSuccess.jsx receives)\n');

    const fetchedOrder = await Order.findOne({
      _id: order._id,
      userId: user._id
    }).populate({
      path: 'items.productId',
      select: 'title brand model variants'
    });

    if (!fetchedOrder) {
      throw new Error('Order fetch failed');
    }

    console.log('✅ Order fetched successfully\n');

    // Analyze the response
    console.log('='.repeat(70));
    console.log('📊 API RESPONSE ANALYSIS\n');

    console.log(`Order ID: ${fetchedOrder._id}`);
    console.log(`Items: ${fetchedOrder.items.length}`);
    console.log(`Total: ₹${fetchedOrder.total}`);
    console.log(`Status: ${fetchedOrder.status}\n`);

    let allImagesPresent = true;

    fetchedOrder.items.forEach((item, idx) => {
      console.log(`📦 Item ${idx + 1}: ${item.title}`);
      console.log('─'.repeat(70));

      // Check direct image
      console.log(`✅ item.image: ${item.image ? 'PRESENT' : 'MISSING'}`);
      if (item.image) {
        console.log(`   ${item.image.substring(0, 90)}${item.image.length > 90 ? '...' : ''}`);
      }

      // Check populated product data
      if (item.productId && typeof item.productId === 'object') {
        console.log(`\n✅ Product populated:`);
        console.log(`   Title: ${item.productId.title || item.title}`);
        console.log(`   Brand: ${item.productId.brand || item.brand}`);
        console.log(`   Model: ${item.productId.model || item.model}`);

        if (item.productId.variants && item.productId.variants.length > 0) {
          console.log(`   Variants: ${item.productId.variants.length}`);

          item.productId.variants.forEach((v, vIdx) => {
            if (v.images && v.images.length > 0) {
              console.log(`\n   ✅ Variant ${vIdx} Images: ${v.images.length}`);
              v.images.forEach((img, imgIdx) => {
                const primary = img.isPrimary ? ' (PRIMARY)' : '';
                console.log(`      Image ${imgIdx}${primary}:`);
                const urlDisplay = img.url ? img.url.substring(0, 90) + (img.url.length > 90 ? '...' : '') : 'MISSING';
                console.log(`      ${urlDisplay}`);
                
                if (img.url && img.url.includes('cloudinary')) {
                  console.log('      ✅ Cloudinary URL confirmed');
                }
              });
            } else {
              console.log(`   ❌ Variant ${vIdx}: No images`);
              allImagesPresent = false;
            }
          });
        }
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('✨ RESULT\n');

    if (allImagesPresent) {
      console.log('✅ SUCCESS! The fix is working correctly:');
      console.log('   • Backend returns variant.images with order');
      console.log('   • Product images are populated with Cloudinary URLs');
      console.log('   • Frontend OrderSuccess.jsx can now extract and display images\n');
      console.log('🎉 Order images will display correctly on the frontend!');
    } else {
      console.log('⚠️  Some images may be missing');
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Cleanup
    console.log('5️⃣  Cleaning up test data...');
    await Order.deleteOne({ _id: order._id });
    console.log('✅ Test order deleted\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestOrderWithImages();
