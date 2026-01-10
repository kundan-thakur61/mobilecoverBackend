const mongoose = require('mongoose');
const Collection = require('./models/Collection');
require('dotenv').config();

async function checkCollections() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copadmob');
    console.log('Connected to MongoDB');
    
    // Check for the collection that's failing
    const fallbackCollection = await Collection.findOne({ handle: 'fallback-krishna-theme' });
    
    if (fallbackCollection) {
      console.log('✓ Collection with handle "fallback-krishna-theme" exists:', fallbackCollection._id.toString());
    } else {
      console.log('✗ Collection with handle "fallback-krishna-theme" does NOT exist');
    }
    
    // Also check for the related collection
    const krishnaThemeCollection = await Collection.findOne({ handle: 'krishna-theme' });
    if (krishnaThemeCollection) {
      console.log('✓ Collection with handle "krishna-theme" exists:', krishnaThemeCollection._id.toString());
    } else {
      console.log('✗ Collection with handle "krishna-theme" does NOT exist');
    }
    
    // Check the original one
    const originalCollection = await Collection.findOne({ handle: '1' });
    if (originalCollection) {
      console.log('✓ Original collection with handle "1" exists:', originalCollection._id.toString());
    } else {
      console.log('✗ Original collection with handle "1" does NOT exist');
    }
    
    // Check all collections with "krishna" in the handle
    const allKrishnaCollections = await Collection.find({ handle: /krishna/i });
    console.log('\nAll collections with "krishna" in handle:');
    allKrishnaCollections.forEach(col => {
      console.log(`- Handle: "${col.handle}", Title: "${col.title}", ID: ${col._id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
}

checkCollections();