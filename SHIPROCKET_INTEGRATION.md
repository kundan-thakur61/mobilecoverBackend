# Shiprocket Integration Guide

This document provides comprehensive information about the Shiprocket API integration in the mobile cover e-commerce platform.

## Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [API Endpoints](#api-endpoints)
4. [Workflow](#workflow)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Overview

The Shiprocket integration enables automated shipping management including:

- **Order Creation**: Automatically create shipments in Shiprocket when orders are confirmed
- **Courier Assignment**: Select and assign courier partners with AWB generation
- **Real-time Tracking**: Track shipments and sync status updates
- **Label Generation**: Generate shipping labels and manifests
- **Webhook Support**: Receive real-time status updates from Shiprocket
- **Return Management**: Handle return shipments

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

The `axios` package is required for making HTTP requests to Shiprocket API.

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Shiprocket Configuration
SHIPROCKET_EMAIL=your-shiprocket-email@example.com
SHIPROCKET_PASSWORD=your-shiprocket-password
SHIPROCKET_API_BASE_URL=https://apiv2.shiprocket.in/v1/external
```

**Getting Shiprocket Credentials:**

1. Sign up at [Shiprocket](https://www.shiprocket.in/)
2. Complete KYC verification
3. Add pickup addresses
4. Go to Settings → API to get your credentials

### 3. Configure Pickup Locations

In your Shiprocket dashboard:

1. Go to **Settings → Pickup Addresses**
2. Add your warehouse/pickup locations
3. Note the "Pickup Location Name" (usually "Primary" for the first one)

### 4. Update Order Flow (Optional Auto-Creation)

The integration is designed to work both manually (admin creates shipments) and automatically. See the "Workflow" section below.

## API Endpoints

### Public Endpoints

#### Track Shipment
```http
GET /api/shiprocket/track/:orderId?orderType=regular
Authorization: Bearer <user-token>
```

**Query Parameters:**
- `orderType`: `regular` or `custom` (default: `regular`)

**Response:**
```json
{
  "success": true,
  "data": {
    "awbCode": "AWB123456789",
    "courierName": "Delhivery",
    "trackingData": {
      "currentStatus": "In Transit",
      "shipmentStatus": "SHIPPED",
      "shipmentTrack": [
        {
          "status": "Picked Up",
          "date": "2024-01-15T10:30:00Z",
          "location": "Mumbai",
          "activity": "Package picked up"
        }
      ],
      "expectedDeliveryDate": "2024-01-20T00:00:00Z"
    }
  }
}
```

#### Check Serviceability
```http
GET /api/shiprocket/check-serviceability?pickupPincode=400001&deliveryPincode=110001&weight=0.5&cod=0
```

**Query Parameters:**
- `pickupPincode`: Pickup location pincode
- `deliveryPincode`: Delivery location pincode
- `weight`: Package weight in kg (default: 0.5)
- `cod`: COD amount (0 for prepaid)

**Response:**
```json
{
  "success": true,
  "data": {
    "serviceable": true,
    "couriers": [
      {
        "id": 1,
        "name": "Delhivery Surface",
        "freight": 45.50,
        "estimatedDeliveryDays": "3-5",
        "rating": 4.5
      }
    ],
    "message": "Delivery available"
  }
}
```

### Admin Endpoints

All admin endpoints require authentication and admin role:
```
Authorization: Bearer <admin-token>
```

#### Create Shipment
```http
POST /api/shiprocket/create-shipment
Content-Type: application/json

{
  "orderId": "64abc123...",
  "orderType": "regular",
  "pickupLocation": "Primary",
  "dimensions": {
    "length": 15,
    "breadth": 10,
    "height": 2
  },
  "weight": 0.15
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipment created successfully in Shiprocket",
  "data": {
    "shipmentId": 12345678,
    "orderId": 98765432,
    "status": "NEW"
  }
}
```

#### Assign Courier
```http
POST /api/shiprocket/assign-courier
Content-Type: application/json

{
  "orderId": "64abc123...",
  "orderType": "regular",
  "courierId": 1
}
```

If `courierId` is not provided, the system automatically selects the cheapest available courier.

**Response:**
```json
{
  "success": true,
  "message": "Courier assigned and AWB generated successfully",
  "data": {
    "awbCode": "AWB123456789",
    "courierName": "Delhivery Surface",
    "shipmentId": 12345678
  }
}
```

#### Get Recommended Couriers
```http
GET /api/shiprocket/recommended-couriers/:orderId?orderType=regular
```

**Response:**
```json
{
  "success": true,
  "data": {
    "couriers": [
      {
        "id": 1,
        "name": "Delhivery Surface",
        "freight": 45.50,
        "estimatedDeliveryDays": "3-5",
        "rating": 4.5,
        "etd": "2024-01-20"
      }
    ]
  }
}
```

#### Request Pickup
```http
POST /api/shiprocket/request-pickup
Content-Type: application/json

{
  "orderId": "64abc123...",
  "orderType": "regular"
}
```

#### Cancel Shipment
```http
POST /api/shiprocket/cancel-shipment
Content-Type: application/json

{
  "orderId": "64abc123...",
  "orderType": "regular"
}
```

#### Generate Label
```http
POST /api/shiprocket/generate-label
Content-Type: application/json

{
  "orderId": "64abc123...",
  "orderType": "regular"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Label generated successfully",
  "data": {
    "labelUrl": "https://shiprocket.co/label/abc123.pdf"
  }
}
```

#### Generate Manifest
```http
POST /api/shiprocket/generate-manifest
Content-Type: application/json

{
  "orderIds": ["64abc123...", "64def456..."],
  "orderType": "regular"
}
```

#### Get Pickup Locations
```http
GET /api/shiprocket/pickup-locations
```

### Webhook Endpoint

```http
POST /api/shiprocket/webhook
```

This endpoint receives status updates from Shiprocket. Configure it in your Shiprocket dashboard.

## Workflow

### Manual Workflow (Admin Dashboard)

1. **Order Placed**: Customer places order, payment confirmed
2. **Admin Reviews Order**: Admin reviews order in dashboard
3. **Create Shipment**: Admin clicks "Create Shipment" button
   ```
   POST /api/shiprocket/create-shipment
   ```
4. **Assign Courier**: Admin selects courier or system auto-selects
   ```
   POST /api/shiprocket/assign-courier
   ```
5. **Generate Label**: System generates shipping label
   ```
   POST /api/shiprocket/generate-label
   ```
6. **Request Pickup**: Admin requests courier pickup
   ```
   POST /api/shiprocket/request-pickup
   ```
7. **Track Shipment**: Customer and admin can track shipment
   ```
   GET /api/shiprocket/track/:orderId
   ```

### Automatic Workflow (Integration with Order Flow)

To enable automatic shipment creation, update your order controller:

```javascript
// In orderController.js - after order is confirmed/paid
if (order.payment.status === 'paid' && order.status === 'confirmed') {
  try {
    const shiprocketService = require('../utils/shiprocket');
    
    // Create shipment in Shiprocket
    const shipmentData = {
      orderId: `ORD-${order._id}`,
      // ... other order data
    };
    
    const shiprocketResponse = await shiprocketService.createOrder(shipmentData);
    
    // Auto-assign cheapest courier
    if (shiprocketResponse.shipment_id) {
      const couriers = await shiprocketService.getRecommendedCouriers(shiprocketResponse.shipment_id);
      if (couriers && couriers.length > 0) {
        const cheapestCourier = couriers.sort((a, b) => a.freight_charge - b.freight_charge)[0];
        const awbResponse = await shiprocketService.assignCourier(
          shiprocketResponse.shipment_id,
          cheapestCourier.courier_company_id
        );
        
        // Update order
        order.shiprocket = {
          shipmentId: shiprocketResponse.shipment_id,
          awbCode: awbResponse.awb_code,
          courierName: awbResponse.courier_name
        };
        await order.save();
      }
    }
  } catch (error) {
    logger.error('Auto-shipment creation failed:', error);
    // Don't fail the order if Shiprocket fails
  }
}
```

## Webhook Configuration

### Setting up Webhooks in Shiprocket

1. Go to **Shiprocket Dashboard → Settings → API**
2. Find "Webhook" section
3. Add your webhook URL:
   ```
   https://your-domain.com/api/shiprocket/webhook
   ```
4. Select events to receive:
   - Shipment Pickup
   - In Transit
   - Out for Delivery
   - Delivered
   - RTO
   - Cancelled

### Webhook Events

The webhook handler automatically:
- Updates order status based on Shiprocket status
- Syncs tracking information
- Emits real-time updates via Socket.IO
- Handles RTO (Return to Origin) scenarios

**Status Mapping:**
- `shipped` / `in transit` → Order status: `shipped`
- `delivered` → Order status: `delivered`
- `cancelled` / `rto` → Order status: `cancelled`

## Testing

### Test Shipment Creation

```bash
# Using curl
curl -X POST http://localhost:4000/api/shiprocket/create-shipment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "orderType": "regular",
    "pickupLocation": "Primary",
    "dimensions": {
      "length": 15,
      "breadth": 10,
      "height": 2
    },
    "weight": 0.15
  }'
```

### Test Serviceability Check

```bash
curl "http://localhost:4000/api/shiprocket/check-serviceability?pickupPincode=400001&deliveryPincode=110001&weight=0.5&cod=0"
```

### Test Webhook (Local Development)

Use tools like [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 4000
```

Then use the ngrok URL in Shiprocket webhook settings:
```
https://your-ngrok-id.ngrok.io/api/shiprocket/webhook
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Error:** `Failed to authenticate with Shiprocket`

**Solution:**
- Verify `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` in `.env`
- Check if your Shiprocket account is active
- Ensure KYC is completed

#### 2. No Couriers Available

**Error:** `No courier services available for this shipment`

**Solution:**
- Check if pickup and delivery pincodes are serviceable
- Verify package dimensions and weight
- Ensure pickup location is properly configured in Shiprocket dashboard
- Check if any courier partnerships are active in your account

#### 3. Shipment Already Created

**Error:** `Shipment already created for this order`

**Solution:**
- This is expected behavior to prevent duplicate shipments
- Check `order.shiprocket.shipmentId` in database
- To recreate, first cancel the existing shipment

#### 4. Invalid Order ID in Webhook

**Error:** `Order not found for webhook`

**Solution:**
- Ensure order IDs are formatted correctly: `ORD-{mongoId}` or `CUST-{mongoId}`
- Check webhook payload in logs
- Verify the order exists in database

### Logs

All Shiprocket operations are logged using Winston:

```javascript
logger.info('Shiprocket operation', { details });
logger.error('Shiprocket error', error);
```

Check logs at:
- Development: Console output
- Production: `backend/logs/` directory

### Support

- **Shiprocket API Docs**: https://apidocs.shiprocket.in/
- **Shiprocket Support**: support@shiprocket.com
- **Integration Issues**: Check application logs and Shiprocket dashboard

## Advanced Features

### Bulk Operations

Generate manifest for multiple orders:

```javascript
const orderIds = ['id1', 'id2', 'id3'];
const response = await fetch('/api/shiprocket/generate-manifest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + adminToken
  },
  body: JSON.stringify({ orderIds, orderType: 'regular' })
});
```

### Custom Dimensions per Product

You can configure default dimensions per product type:

```javascript
// In your product model or configuration
const productDimensions = {
  'mobile-cover': { length: 15, breadth: 10, height: 2, weight: 0.15 },
  'phone-case': { length: 20, breadth: 12, height: 3, weight: 0.25 }
};
```

### Return Orders

For handling returns, use the `createReturn` method:

```javascript
await shiprocketService.createReturn({
  orderId: 'RET-123',
  // Customer details become pickup details
  pickupCustomerName: order.shippingAddress.name,
  pickupAddress: order.shippingAddress.address1,
  // Your warehouse becomes shipping address
  shippingCustomerName: 'Your Company',
  // ... other details
});
```

## Production Checklist

Before going live:

- [ ] Add Shiprocket credentials to production `.env`
- [ ] Configure webhook URL in Shiprocket dashboard
- [ ] Test with a real order (use small value item)
- [ ] Set up proper pickup locations
- [ ] Configure courier preferences
- [ ] Test webhook reception
- [ ] Monitor logs for any errors
- [ ] Set up alerts for failed shipments
- [ ] Document internal workflow for team

## Rate Limits

Shiprocket API has rate limits:
- **Authentication**: 10 requests per minute
- **Other endpoints**: 100 requests per minute

The service automatically handles token refresh to minimize authentication calls.
