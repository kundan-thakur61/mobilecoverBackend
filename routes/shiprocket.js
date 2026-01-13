const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminMiddleware } = require('../middleware/adminMiddleware');
const {
  createShipment,
  trackShipment,
  cancelShipment,
  checkServiceability,
  getPickupLocations,
  handleWebhook,
  generateLabel,
  getRecommendedCouriers,
  assignCourier,
  requestPickup
} = require('../controllers/shiprocketController');

/**
 * SHIPROCKET API ROUTES
 * 
 * Public routes (no auth required):
 * - GET /check-serviceability - Check if delivery available to pincode
 * - GET /track/:identifier - Track shipment by AWB or order ID
 * 
 * Admin routes (authentication + admin role required):
 * - POST /create-shipment - Create new shipment
 * - POST /cancel-shipment - Cancel shipment
 * - POST /generate-label - Generate shipping labels
 * - GET /pickup-locations - Get warehouse/pickup locations
 * 
 * Webhook routes (token-based auth):
 * - POST /webhook - Receive status updates from Shiprocket
 */

// =============================================================================
// PUBLIC ROUTES (No authentication required)
// =============================================================================

/**
 * @route   GET /api/shiprocket/check-serviceability
 * @desc    Check if delivery is available to a pincode
 * @access  Public
 * @query   deliveryPincode - Destination pincode (required)
 * @query   pickupPincode - Origin pincode (optional)
 * @query   weight - Package weight in kg (optional, default: 0.5)
 * @query   cod - COD amount (optional, default: 0)
 */
router.get('/check-serviceability', checkServiceability);

/**
 * @route   GET /api/shiprocket/track/:identifier
 * @desc    Track shipment by AWB number or order ID
 * @access  Public
 * @param   identifier - AWB number or MongoDB order ID
 * @query   orderType - 'regular' or 'custom' (default: 'regular')
 */
router.get('/track/:identifier', trackShipment);

// =============================================================================
// ADMIN ROUTES (Authentication + Admin role required)
// =============================================================================

/**
 * @route   POST /api/shiprocket/create-shipment
 * @desc    Create a new shipment in Shiprocket
 * @access  Admin only
 * @body    orderId - MongoDB order ID (required)
 * @body    orderType - 'regular' or 'custom' (default: 'regular')
 * @body    pickupLocationId - Pickup location ID (optional)
 * @body    dimensions - { length, breadth, height } in cm (optional)
 * @body    weight - Package weight in kg (optional, default: 0.15)
 */
router.post('/create-shipment', authMiddleware, adminMiddleware, createShipment);

/**
 * @route   POST /api/shiprocket/assign-courier
 * @desc    Assign courier to an order (alias for create-shipment)
 * @access  Admin only
 * @body    orderId - MongoDB order ID (required)
 * @body    orderType - 'regular' or 'custom' (default: 'regular')
 * @body    pickupLocationId - Pickup location ID (optional)
 * @body    dimensions - { length, breadth, height } in cm (optional)
 * @body    weight - Package weight in kg (optional, default: 0.15)
 */
router.post('/assign-courier', authMiddleware, adminMiddleware, assignCourier);

/**
 * @route   POST /api/shiprocket/cancel-shipment
 * @desc    Cancel a shipment
 * @access  Admin only
 * @body    orderId - MongoDB order ID (required)
 * @body    orderType - 'regular' or 'custom' (default: 'regular')
 * @body    reason - Cancellation reason (optional)
 */
router.post('/cancel-shipment', authMiddleware, adminMiddleware, cancelShipment);

/**
 * @route   POST /api/shiprocket/generate-label
 * @desc    Generate shipping labels
 * @access  Admin only
 * @body    orderIds - Array of order IDs (required)
 * @body    orderType - 'regular' or 'custom' (default: 'regular')
 */
router.post('/generate-label', authMiddleware, adminMiddleware, generateLabel);

/**
 * @route   GET /api/shiprocket/recommended-couriers/:orderId
 * @desc    Get recommended couriers for an order
 * @access  Admin only
 * @param   orderId - MongoDB order ID (required)
 * @query   orderType - 'regular' or 'custom' (default: 'regular')
 */
router.get('/recommended-couriers/:orderId', authMiddleware, adminMiddleware, getRecommendedCouriers);

/**
 * @route   POST /api/shiprocket/request-pickup
 * @desc    Request pickup for a shipment
 * @access  Admin only
 * @body    orderId - MongoDB order ID (required)
 * @body    orderType - 'regular' or 'custom' (default: 'regular')
 * @body    pickupDate - Pickup date (optional)
 * @body    pickupTimeFrom - Pickup time from (optional, default: '10:00')
 * @body    pickupTimeTo - Pickup time to (optional, default: '18:00')
 */
router.post('/request-pickup', authMiddleware, adminMiddleware, requestPickup);

/**
 * @route   GET /api/shiprocket/pickup-locations
 * @desc    Get list of configured pickup locations
 * @access  Admin only
 */
router.get('/pickup-locations', authMiddleware, adminMiddleware, getPickupLocations);

// =============================================================================
// WEBHOOK ROUTES (Token-based authentication)
// =============================================================================

/**
 * @route   POST /api/shiprocket/webhook
 * @desc    Receive status updates from Shiprocket
 * @access  Webhook (requires x-api-key header with token)
 * @header  x-api-key - Webhook authentication token
 * @body    Shiprocket webhook payload
 * 
 * Setup Instructions:
 * 1. Set SHIPROCKET_WEBHOOK_SECRET in your .env file
 * 2. Configure this URL in Shiprocket dashboard: https://yourdomain.com/api/shiprocket/webhook
 * 3. Add the same token as 'x-api-key' header in Shiprocket webhook settings
 */
router.post('/webhook', handleWebhook);

// Alternative webhook route (for flexibility)
router.post('/webhooks/shiprocket', handleWebhook);

module.exports = router;