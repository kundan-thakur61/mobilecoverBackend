#!/usr/bin/env node
/**
 * Script to set up local MongoDB for development
 * This creates a local .env.local file with MongoDB connection for local development
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up local MongoDB configuration...');

// Check if MongoDB is installed locally
const { execSync } = require('child_process');

try {
  execSync('mongod --version', { stdio: 'pipe' });
  console.log('✅ MongoDB is installed locally');
  
  // Create local .env file
  const localEnvPath = path.join(__dirname, '..', '.env.local');
  const localEnvContent = `# Local Development Configuration
MONGO_URI=mongodb://localhost:27017/coverghar_dev
NODE_ENV=development
`;
  
  fs.writeFileSync(localEnvPath, localEnvContent);
  console.log('✅ Created .env.local with local MongoDB configuration');
  console.log('📁 File created:', localEnvPath);
  console.log('\n📝 To use local MongoDB:');
  console.log('1. Start MongoDB service: mongod');
  console.log('2. Run backend with: NODE_ENV=development node index.js');
  console.log('3. Or modify your package.json dev script to use .env.local');
  
} catch (error) {
  console.log('⚠️  MongoDB not found locally');
  console.log('💡 Install MongoDB locally or whitelist your IP in MongoDB Atlas');
  console.log('🔗 MongoDB Atlas IP Whitelist Guide: https://docs.atlas.mongodb.com/security/ip-access-list/');
}