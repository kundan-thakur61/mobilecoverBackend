#!/usr/bin/env node
/**
 * Script to add variants with images to existing products
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');

async function addVariantsToProducts() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Sample image from Cloudinary (the one you showed earlier)
    const sampleImageUrl = 'https://res.cloudinary.com/dwmytphop/image/upload/v1766473299/ChatGPT_Image_Dec_23_2025_12_30_26_PM_oyeb3g.jpg';

    // Find all products without variants
    const products = await Product.find();
    console.log(`\nFound ${products.length} products. Processing...`);

    for (const product of products) {
      if (product.variants.length === 0) {
        console.log(`\nAdding variants to: ${product.title}`);
        
        // Add some color variants
        const colors = ['Black', 'White', 'Blue', 'Red'];
        const basePrice = 199;
        
        product.variants = colors.map((color, idx) => ({
          color,
          price: basePrice + (idx * 50),
          stock: 10,
          sku: `${product.model}-${color.toUpperCase()}-001`,
          images: [{
            url: sampleImageUrl,
            publicId: 'sample-image',
            isPrimary: idx === 0 // First variant is primary
          }],
          isActive: true
        }));

        await product.save();
        console.log(`  ✓ Added ${colors.length} color variants with images`);
      } else {
        console.log(`${product.title} already has ${product.variants.length} variants`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✓ Done! All products now have variants with images');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addVariantsToProducts();
