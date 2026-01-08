const express = require('express');
const router = express.Router();
const { 
  createShipment, 
  assignCourier, 
  getRecommendedCouriers, 
  requestPickup, 
  trackShipment, 
  cancelShipment, 
  generateLabel, 
  generateManifest, 
  handleWebhook,
  checkServiceability,
  getPickupLocations
} = require('../controllers/deliveryOneController');

const { authMiddleware } = require('../middleware/authMiddleware');

// Public endpoints
router.get('/track/:orderId', trackShipment);
router.get('/check-serviceability', checkServiceability);

// Admin endpoints (require authentication)
router.post('/create-shipment', authMiddleware, createShipment);
router.post('/assign-courier', authMiddleware, assignCourier);
router.get('/recommended-couriers/:orderId', authMiddleware, getRecommendedCouriers);
router.post('/request-pickup', authMiddleware, requestPickup);
router.post('/cancel-shipment', authMiddleware, cancelShipment);
router.post('/generate-label', authMiddleware, generateLabel);
router.post('/generate-manifest', authMiddleware, generateManifest);
router.get('/pickup-locations', authMiddleware, getPickupLocations);

// Webhook endpoint (public)
router.post('/webhook', handleWebhook);
router.get('/webhook', handleWebhook); // For testing

module.exports = router;