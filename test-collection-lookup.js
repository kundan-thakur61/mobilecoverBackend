require('dotenv').config();
const mongoose = require('mongoose');
const { findCollectionByIdentifier } = require('./controllers/collectionController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce';

async function testCollectionLookup() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Test with handle
    const collectionByHandle = await findCollectionByIdentifier('fallback-krishna-theme');
    if (collectionByHandle) {
      console.log('✓ Found collection by handle "fallback-krishna-theme":', collectionByHandle._id.toString());
    } else {
      console.log('✗ Collection not found by handle "fallback-krishna-theme"');
    }

    // Test with ObjectId (if we have one)
    const collectionById = await findCollectionByIdentifier('6961175a7cf58860f7805ef0');
    if (collectionById) {
      console.log('✓ Found collection by ObjectId:', collectionById._id.toString());
    } else {
      console.log('✗ Collection not found by ObjectId');
    }

    // Test with invalid handle
    const invalid = await findCollectionByIdentifier('nonexistent-handle');
    if (!invalid) {
      console.log('✓ Correctly returned null for invalid handle');
    } else {
      console.log('✗ Unexpectedly found collection for invalid handle');
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testCollectionLookup();
