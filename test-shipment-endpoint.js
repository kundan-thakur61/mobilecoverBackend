require('dotenv').config();
const express = require('express');
const delhiveryService = require('./utils/deliveryOne');

// Create a minimal test app
const app = express();
app.use(express.json());

// Import the controller function
const { createShipment } = require('./controllers/deliveryOneController');

// Mock middleware for testing
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-admin-id' };
  next();
};

// Test endpoint
app.post('/api/deliveryone/create-shipment', mockAuth, createShipment);

// Start test server
const PORT = 4002;
app.listen(PORT, async () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  
  // Test the shipment creation
  try {
    const testResponse = await fetch(`http://localhost:${PORT}/api/deliveryone/create-shipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: '6963958b663e353e899d9114',
        orderType: 'regular',
        dimensions: {
          length: 15,
          breadth: 10,
          height: 2
        },
        weight: 0.15
      })
    });
    
    const result = await testResponse.json();
    console.log('✅ Shipment creation test result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('🎉 Delhivery integration is working correctly!');
    } else {
      console.log('❌ Shipment creation failed:', result.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
});
