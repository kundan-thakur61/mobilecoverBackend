const express = require('express');
const axios = require('axios');
const router = express.Router();

const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
const { getShiprocketToken } = require('../services/shiprocketService'); // Use cached token service
const { handleShiprocketWebhook } = require('../controllers/shiprocketWebhookController');

const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/create-shipment', authMiddleware, async (req, res) => {
  try {
    // 1. Get the Auth Token
    const token = await getShiprocketToken();
    let { orderId, orderType, pickupLocation, dimensions, weight } = req.body;

    // Validate or auto-select pickup location
    try {
      const pickupRes = await axios.get('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const locations = pickupRes.data?.data?.shipping_address || [];
      
      if (locations.length > 0) {
        // Check if provided location exists in the list
        const isValid = pickupLocation && locations.some(l => l.pickup_location === pickupLocation);
        
        if (!isValid) {
          // If invalid or missing, use the first available location
          pickupLocation = locations[0].pickup_location;
        }
      }
    } catch (err) {
      console.warn("Could not validate pickup location:", err.message);
    }

    // 2. Fetch Order details if orderId is provided
    let dbOrder = null;
    if (orderId) {
      try {
        if (orderType === 'custom') {
          dbOrder = await CustomOrder.findById(orderId);
        } else {
          dbOrder = await Order.findById(orderId);
        }
      } catch (err) {
        console.warn(`Could not fetch order ${orderId}:`, err.message);
      }
    }

    // 3. Map data to Shiprocket's expected format
    const orderDate = dbOrder ? new Date(dbOrder.createdAt) : new Date();
    // Format: YYYY-MM-DD HH:MM
    const formattedDate = orderDate.toISOString().split('T')[0] + " " + 
                          orderDate.toTimeString().split(' ')[0].substring(0, 5);

    const address = dbOrder ? dbOrder.shippingAddress : {
      name: (req.body.firstName || '') + ' ' + (req.body.lastName || ''),
      address1: req.body.address,
      city: req.body.city,
      postalCode: req.body.pincode,
      state: req.body.state,
      phone: req.body.phone,
      country: "India"
    };

    // Split name into first and last
    const fullName = address.name || "Customer";
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || ".";

    const paymentMethod = (dbOrder && dbOrder.payment && dbOrder.payment.method === 'cod') ? "COD" : "Prepaid";

    let items = [];
    if (dbOrder && Array.isArray(dbOrder.items) && dbOrder.items.length) {
      items = dbOrder.items.map(item => {
        // Prefer item.sku if available, otherwise fallback to IDs
        const rawSku = item.sku || item.productId || 'SKU-NA';

        // Shiprocket limit is 50 chars. Ensure we truncate if longer.
        let sku = String(rawSku).trim();

        if (sku.length > 50) {
          console.log(`[Shiprocket] Truncating SKU from ${sku.length} chars to fit limit`);
          sku = sku.slice(-40);
        }

        return {
          name: item.title || item.name || "Product",
          sku: sku,
          units: item.quantity,
          selling_price: parseInt(item.price),
          discount: 0,
          tax: 0,
          hsn: 0
        };
      });
    } else if (dbOrder && orderType === 'custom') {
      const customPrice = dbOrder.price || (dbOrder.variant && dbOrder.variant.price) || 0;
      let sku = (dbOrder.variant && dbOrder.variant.sku) || (dbOrder.productId ? dbOrder.productId.toString() : "sku-123");

      // Shiprocket limit is 50 chars. Ensure we truncate if longer.
      if (sku.length > 50) {
        console.log(`[Shiprocket] Truncating Custom SKU from ${sku.length} chars to fit limit`);
        sku = sku.slice(-40);
      }

      items = [{
        name: "Custom Product",
        sku: sku,
        units: dbOrder.quantity || 1,
        selling_price: parseInt(customPrice),
        discount: 0,
        tax: 0,
        hsn: 0
      }];
    } else if (req.body.items) {
      items = req.body.items.map(item => ({
        name: item.name,
        sku: item.sku || "sku-123",
        units: item.quantity,
        selling_price: parseInt(item.price),
        discount: 0,
        tax: 0,
        hsn: 0
      }));
    }

    if (!items.length) {
      items = [{
        name: "Product",
        sku: "sku-123",
        units: 1,
        selling_price: parseInt(req.body.totalAmount || 0) || 0,
        discount: 0,
        tax: 0,
        hsn: 0
      }];
    }

    const subTotal = dbOrder ? (dbOrder.total || (dbOrder.price && dbOrder.quantity ? dbOrder.price * dbOrder.quantity : 0)) : (req.body.totalAmount || 0);

    const shipmentPayload = {
      order_id: orderId ? `${orderId}-${Date.now()}` : (req.body.order_id || `ORD-${Date.now()}`),
      order_date: formattedDate,
      pickup_location: pickupLocation || "Primary",
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: address.address1 || address.street || "Address",
      billing_city: address.city || "City",
      billing_pincode: address.postalCode || address.zipCode || "000000",
      billing_state: address.state || "State",
      billing_country: address.country || "India",
      billing_email: req.body.email || "customer@example.com",
      billing_phone: address.phone || "9999999999",
      shipping_is_billing: true,
      order_items: items,
      payment_method: paymentMethod,
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: subTotal,
      length: (dimensions && dimensions.length) || req.body.length || 15,
      breadth: (dimensions && dimensions.breadth) || req.body.breadth || 10,
      height: (dimensions && dimensions.height) || req.body.height || 2,
      weight: weight || req.body.weight || 0.5
    };

    console.log("Shiprocket Payload:", JSON.stringify(shipmentPayload, null, 2));

    // 4. Call Shiprocket Create Order API
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
      shipmentPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log("Shiprocket Response:", response.data);

    // Check for logical errors from Shiprocket (even if status is 200)
    if (!response.data.shipment_id || response.data.status === 'CANCELED') {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Shipment creation failed or returned canceled status",
        details: response.data
      });
    }

    // Save Shiprocket details to the Order in DB
    if (dbOrder) {
      dbOrder.shiprocket = dbOrder.shiprocket || {};
      dbOrder.shiprocket.shipmentId = response.data.shipment_id;
      dbOrder.shiprocket.orderId = response.data.order_id;
      dbOrder.shiprocket.awbCode = response.data.awb_code;
      await dbOrder.save();
    }

    // 4. Send success response back to frontend
    res.status(200).json({
      success: true,
      shipment_id: response.data.shipment_id,
      order_id: response.data.order_id,
      awb_code: response.data.awb_code, // Might be null initially until courier is assigned
      message: "Shipment created successfully"
    });

  } catch (error) {
    // Detailed error logging
    const errorMsg = error.response?.data || error.message;
    console.error("Create Shipment Failed:", JSON.stringify(errorMsg, null, 2));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMsg
    });
  }
});

// Assign Courier Route (Fixes 404)
router.post('/assign-courier', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { shipment_id, courier_id, orderId, orderType } = req.body;

    let shipmentId = shipment_id;

    // If shipment_id not provided, try to find it from order
    let dbOrder = null;
    if (!shipmentId && orderId) {
      if (orderType === 'custom') {
        dbOrder = await CustomOrder.findById(orderId);
      } else {
        dbOrder = await Order.findById(orderId);
      }
      if (dbOrder && dbOrder.shiprocket) {
        shipmentId = dbOrder.shiprocket.shipmentId;
      }
    }

    if (!shipmentId) {
      return res.status(400).json({ error: "shipment_id is required or order not found with shipment" });
    }

    // If courier_id is not provided, Shiprocket auto-assigns the best one? 
    // Actually /courier/assign/awb usually requires courier_id or it might fail.
    // But let's pass what we have.
    const payload = { shipment_id: shipmentId };
    if (courier_id) payload.courier_id = courier_id;

    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    // Check if assignment was actually successful
    if (response.data.awb_assign_status === 0) {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Failed to assign courier",
        data: response.data
      });
    }

    // Update AWB in DB if successful
    if (response.data.awb_assign_status === 1 && dbOrder) {
      dbOrder.shiprocket = dbOrder.shiprocket || {};
      dbOrder.shiprocket.awbCode = response.data.response.data.awb_code;
      dbOrder.shiprocket.courierName = response.data.response.data.courier_name;
      await dbOrder.save();
    }

    res.status(200).json({
      success: true,
      data: response.data,
      message: "Courier assigned successfully"
    });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Check Serviceability Failed:", JSON.stringify(errorMsg, null, 2));
    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Track Shipment Route
router.get('/track/:awbCode', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { awbCode } = req.params;

    if (!awbCode) {
      return res.status(400).json({ error: "AWB Code is required" });
    }

    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    res.status(200).json({
      success: true,
      tracking_data: response.data,
      message: "Tracking details fetched successfully"
    });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Tracking Failed:", JSON.stringify(errorMsg, null, 2));
    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Get Pickup Locations
router.get('/pickup-locations', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const response = await axios.get('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    res.status(200).json({
      success: true,
      data: response.data.data // Contains shipping_address array
    });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Get Pickup Locations Failed:", JSON.stringify(errorMsg, null, 2));
    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Check Serviceability (Public or Auth)
router.get('/check-serviceability', async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { pickupPincode, deliveryPincode, weight, cod } = req.query;

    const params = {
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight: weight || 0.5,
      cod: cod === 'true' || cod === '1' ? 1 : 0
    };

    const response = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
      headers: { 'Authorization': `Bearer ${token}` },
      params
    });

    res.status(200).json({
      success: true,
      data: response.data.data
    });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Assign Courier Failed:", JSON.stringify(errorMsg, null, 2));
    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Get Recommended Couriers for a specific Order
router.get('/recommended-couriers/:orderId', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { orderId } = req.params;
    const { orderType, pickupLocation } = req.query;

    // 1. Fetch Order
    let dbOrder;
    if (orderType === 'custom') {
      dbOrder = await CustomOrder.findById(orderId);
    } else {
      dbOrder = await Order.findById(orderId);
    }

    if (!dbOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 2. Get Pickup Pincode
    let pickupPincode;
    
    // Fetch pickup locations to find the pincode for the named location
    const pickupRes = await axios.get('https://apiv2.shiprocket.in/v1/external/settings/company/pickup', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const locations = pickupRes.data.data?.shipping_address || [];
    
    if (pickupLocation) {
      const loc = locations.find(l => l.pickup_location === pickupLocation);
      if (loc) pickupPincode = loc.pin_code;
    }
    
    // Fallback to first location if not found
    if (!pickupPincode && locations.length > 0) {
      pickupPincode = locations[0].pin_code;
    }

    if (!pickupPincode) {
      return res.status(400).json({ success: false, message: "Could not determine pickup pincode. Please configure pickup locations in Shiprocket." });
    }

    // 3. Call Serviceability API
    const deliveryPincode = dbOrder.shippingAddress.postalCode || dbOrder.shippingAddress.zipCode;
    
    const params = {
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight: 0.5, 
      cod: dbOrder.paymentMethod === 'cod' ? 1 : 0
    };

    const response = await axios.get('https://apiv2.shiprocket.in/v1/external/courier/serviceability/', {
      headers: { 'Authorization': `Bearer ${token}` },
      params
    });

    res.status(200).json({
      success: true,
      data: response.data.data
    });

  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Recommended Couriers Failed:", JSON.stringify(errorMsg, null, 2));
    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Request Pickup
router.post('/request-pickup', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { shipment_id, orderId, orderType } = req.body;

    let shipmentId = shipment_id;
    if (!shipmentId && orderId) {
      const dbOrder = orderType === 'custom' ? await CustomOrder.findById(orderId) : await Order.findById(orderId);
      shipmentId = dbOrder?.shiprocket?.shipmentId;
    }

    if (!shipmentId) {
      return res.status(400).json({ error: "shipment_id required. Please create shipment first." });
    }

    const shipmentIds = Array.isArray(shipmentId) ? shipmentId : [shipmentId];

    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/courier/generate/pickup', 
      { shipment_id: shipmentIds },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Request Pickup Failed:", JSON.stringify(errorMsg, null, 2));

    const msg = errorMsg?.message || '';
    if (msg.toLowerCase().includes('awb not assigned')) {
      return res.status(400).json({ 
        success: false, 
        error: "AWB not assigned. Please 'Assign Courier' to this shipment first." 
      });
    }

    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Generate Label
router.post('/generate-label', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { shipment_id, orderId, orderType } = req.body;

    let shipmentId = shipment_id;
    if (!shipmentId && orderId) {
      const dbOrder = orderType === 'custom' ? await CustomOrder.findById(orderId) : await Order.findById(orderId);
      shipmentId = dbOrder?.shiprocket?.shipmentId;
    }

    if (!shipmentId) {
      return res.status(400).json({ error: "shipment_id required. Please create shipment first." });
    }

    const shipmentIds = Array.isArray(shipmentId) ? shipmentId : [shipmentId];

    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/courier/generate/label', 
      { shipment_id: shipmentIds },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Generate Label Failed:", JSON.stringify(errorMsg, null, 2));

    const msg = errorMsg?.message || '';
    if (msg.toLowerCase().includes('awb not assigned')) {
      return res.status(400).json({ 
        success: false, 
        error: "AWB not assigned. Please 'Assign Courier' to this shipment first." 
      });
    }

    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Generate Manifest
router.post('/generate-manifest', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { shipment_id, orderId, orderType } = req.body;

    let shipmentId = shipment_id;
    if (!shipmentId && orderId) {
      const dbOrder = orderType === 'custom' ? await CustomOrder.findById(orderId) : await Order.findById(orderId);
      shipmentId = dbOrder?.shiprocket?.shipmentId;
    }

    if (!shipmentId) {
      return res.status(400).json({ error: "shipment_id required. Please create shipment first." });
    }

    const shipmentIds = Array.isArray(shipmentId) ? shipmentId : [shipmentId];

    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/manifests/generate', 
      { shipment_id: shipmentIds },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Generate Manifest Failed:", JSON.stringify(errorMsg, null, 2));

    const msg = errorMsg?.message || '';
    if (msg.toLowerCase().includes('awb not assigned')) {
      return res.status(400).json({ 
        success: false, 
        error: "AWB not assigned. Please 'Assign Courier' to this shipment first." 
      });
    }

    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Cancel Shipment
router.post('/cancel-shipment', authMiddleware, async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const { orderId, orderType } = req.body;

    let shiprocketOrderId;

    if (orderId) {
      const dbOrder = orderType === 'custom' ? await CustomOrder.findById(orderId) : await Order.findById(orderId);
      shiprocketOrderId = dbOrder?.shiprocket?.orderId;
    }

    if (!shiprocketOrderId) {
      return res.status(400).json({ error: "Shiprocket Order ID not found. Please ensure shipment is created." });
    }

    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/cancel', 
      { ids: [shiprocketOrderId] },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Cancel Shipment Failed:", JSON.stringify(errorMsg, null, 2));
    res.status(error.response?.status || 500).json({ success: false, error: errorMsg });
  }
});

// Shiprocket Webhook Endpoint
// This route is public and does not use authMiddleware.
// Security is handled by checking the x-api-key header inside the controller.
// GET route for testing endpoint availability (e.g., via browser)
router.get('/webhook', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Shiprocket webhook endpoint is active'
  });
});
router.post('/webhook', handleShiprocketWebhook);

module.exports = router;
