#!/usr/bin/env node
/**
 * MongoDB Connection Diagnostic Script
 * Tests connection to MongoDB Atlas and provides troubleshooting information
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testMongoDBConnection() {
  console.log('🔍 MongoDB Connection Diagnostic');
  console.log('================================');
  
  // Check environment variables
  console.log('\n📋 Environment Variables Check:');
  console.log(`MONGO_URI: ${process.env.MONGO_URI ? '✓ Configured' : '✗ Missing'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  
  if (!process.env.MONGO_URI) {
    console.log('❌ MONGO_URI is not set in environment variables');
    return;
  }
  
  console.log(`\n🔗 Connection String: ${process.env.MONGO_URI.substring(0, 50)}...`);
  
  // Test connection
  console.log('\n🔄 Testing MongoDB Connection...');
  
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test basic operations
    console.log('\n🧪 Testing Database Operations...');
    
    // Try to list collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections in database`);
    
    // Close connection
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.log('❌ Connection failed!');
    console.log(`Error: ${error.message}`);
    
    // Provide specific troubleshooting advice
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Troubleshooting Tips:');
      console.log('- Check if MongoDB service is running');
      console.log('- Verify the connection string is correct');
    } else if (error.message.includes('Authentication failed')) {
      console.log('\n💡 Troubleshooting Tips:');
      console.log('- Check username and password in connection string');
      console.log('- Verify database user has proper permissions');
    } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('\n💡 Troubleshooting Tips:');
      console.log('- Check internet connection');
      console.log('- Verify cluster name in connection string');
    } else if (error.message.includes('timed out') || error.message.includes('Server selection')) {
      console.log('\n💡 Troubleshooting Tips:');
      console.log('- Your IP address may not be whitelisted in MongoDB Atlas');
      console.log('- Go to MongoDB Atlas → Network Access → Add IP Address');
      console.log('- Add your current IP: 223.237.130.22');
      console.log('- Or temporarily add 0.0.0.0/0 for development');
    }
  }
}

// Run the diagnostic
testMongoDBConnection().catch(console.error);