#!/usr/bin/env node
/**
 * Script: attachProductImages.js
 * Purpose: Attach image URLs (from Cloudinary or elsewhere) to product variants.
 * Usage:
 *   node backend/scripts/attachProductImages.js --mapping=backend/scripts/sample-image-map.json [--dry=true]
 * Requirements:
 *   - `MONGODB_URI` env var pointing to your database, or runs against default local DB.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Product = require('../models/Product');

const argv = process.argv.slice(2);
function getArg(name) {
  const match = argv.find(a => a.startsWith(`--${name}=`));
  if (!match) return null;
  return match.split('=')[1];
}

const mappingArg = getArg('mapping') || 'backend/scripts/sample-image-map.json';
const dry = (getArg('dry') || 'false') === 'true' || argv.includes('--dry');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob';

async function main() {
  const mapPath = path.isAbsolute(mappingArg) ? mappingArg : path.join(process.cwd(), mappingArg);
  if (!fs.existsSync(mapPath)) {
    console.error('Mapping file not found:', mapPath);
    process.exit(1);
  }

  let mappings;
  try {
    mappings = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse mapping file:', err.message);
    process.exit(1);
  }

  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  for (const entry of mappings) {
    const { productId, variantIndex, variantSku, images } = entry;
    if (!productId) {
      console.warn('Skipping entry without productId:', entry);
      continue;
    }

    const product = await Product.findById(productId);
    if (!product) {
      console.warn('Product not found:', productId);
      continue;
    }

    let variant;
    if (typeof variantIndex === 'number') {
      variant = product.variants[variantIndex];
    } else if (variantSku) {
      variant = product.variants.find(v => v.sku === variantSku);
    } else {
      // default to first variant
      variant = product.variants[0];
    }

    if (!variant) {
      console.warn(`Variant not found for product ${productId} (index: ${variantIndex}, sku: ${variantSku})`);
      continue;
    }

    if (!Array.isArray(images) || images.length === 0) {
      console.warn('No images provided for entry:', entry);
      continue;
    }

    // Prepare new images
    const newImages = images.map(img => ({
      url: img.url || img.secure_url || img.path || img.publicUrl || '',
      publicId: img.publicId || img.public_id || img.publicId || '',
      isPrimary: !!img.isPrimary
    })).filter(i => i.url);

    if (newImages.length === 0) {
      console.warn('No valid image URLs for entry:', entry);
      continue;
    }

    if (dry) {
      console.log('[dry] Would attach to', productId, 'variant ->', (variantSku || variantIndex || 0), newImages);
      continue;
    }

    // If any new image isPrimary, unset existing primary flags for this variant
    if (newImages.some(i => i.isPrimary)) {
      variant.images.forEach(img => { img.isPrimary = false; });
    }

    // Append new images
    for (const ni of newImages) {
      variant.images.push(ni);
    }

    try {
      await product.save();
      console.log('Updated product', productId, 'variant ->', (variantSku || variantIndex || 0), 'added', newImages.length, 'images');
    } catch (err) {
      console.error('Failed to save product', productId, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
