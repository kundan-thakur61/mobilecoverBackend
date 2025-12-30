#!/usr/bin/env node
/**
 * Quick Shiprocket API Tester
 * Usage: node shiprocket-test.js [command]
 * 
 * Commands:
 *   auth              - Test authentication
 *   pickup            - Show pickup locations
 *   check <pincode>   - Check serviceability to pincode
 *   couriers          - Show available couriers (Delhi to Mumbai)
 *   help              - Show this help
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';
let token = null;

async function authenticate() {
  const response = await axios.post(`${API_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD
  });
  token = response.data.token;
  return token;
}

async function getPickupLocations() {
  if (!token) await authenticate();
  const response = await axios.get(`${API_BASE}/settings/company/pickup`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.data.shipping_address;
}

async function checkServiceability(deliveryPin) {
  if (!token) await authenticate();
  const response = await axios.get(`${API_BASE}/courier/serviceability/`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      pickup_postcode: '825418', // Your pickup location
      delivery_postcode: deliveryPin,
      weight: 0.15,
      cod: 0
    }
  });
  return response.data.data;
}

// Command handlers
const commands = {
  async auth() {
    console.log('Testing authentication...');
    const token = await authenticate();
    console.log('✓ Success!');
    console.log('Token:', token.substring(0, 50) + '...');
  },

  async pickup() {
    console.log('Fetching pickup locations...\n');
    const locations = await getPickupLocations();
    locations.forEach((loc, i) => {
      console.log(`${i + 1}. ${loc.pickup_location}`);
      console.log(`   ${loc.address}, ${loc.city} - ${loc.pin_code}`);
      console.log(`   Phone: ${loc.phone}\n`);
    });
  },

  async check(pincode) {
    if (!pincode) {
      console.error('Error: Please provide a pincode');
      console.log('Usage: node shiprocket-test.js check 400001');
      return;
    }
    console.log(`Checking delivery to ${pincode}...\n`);
    const data = await checkServiceability(pincode);
    
    if (data.available_courier_companies && data.available_courier_companies.length > 0) {
      console.log(`✓ Delivery available! (${data.available_courier_companies.length} couriers)\n`);
      data.available_courier_companies.slice(0, 5).forEach((c, i) => {
        console.log(`${i + 1}. ${c.courier_name}`);
        console.log(`   Rate: ₹${c.rate} | Delivery: ${c.estimated_delivery_days} days`);
      });
    } else {
      console.log('✗ Delivery not available to this pincode');
    }
  },

  async couriers() {
    console.log('Getting available couriers (Jharkhand to Mumbai)...\n');
    const data = await checkServiceability('400001');
    
    console.log(`Found ${data.available_courier_companies.length} couriers:\n`);
    data.available_courier_companies.forEach((c, i) => {
      console.log(`${i + 1}. ${c.courier_name}`);
      console.log(`   Rate: ₹${c.rate}`);
      console.log(`   Delivery: ${c.estimated_delivery_days} days`);
      console.log(`   COD: ${c.cod === 1 ? 'Yes' : 'No'}\n`);
    });
  },

  help() {
    console.log(`
Shiprocket Quick Tester
=======================

Commands:
  auth              - Test authentication
  pickup            - Show pickup locations
  check <pincode>   - Check serviceability to pincode
  couriers          - Show available couriers
  help              - Show this help

Examples:
  node shiprocket-test.js auth
  node shiprocket-test.js pickup
  node shiprocket-test.js check 400001
  node shiprocket-test.js couriers
    `);
  }
};

// Main
(async () => {
  const command = process.argv[2] || 'help';
  const arg = process.argv[3];

  if (commands[command]) {
    try {
      await commands[command](arg);
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
    }
  } else {
    console.log(`Unknown command: ${command}`);
    commands.help();
  }
})();
