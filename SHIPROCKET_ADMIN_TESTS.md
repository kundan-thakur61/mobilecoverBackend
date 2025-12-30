# Shiprocket Admin Endpoints - Complete Test Guide

## Setup Required

Before testing, ensure:
1. Server is running: `npm run dev`
2. Admin user exists with email: `admin@example.com`, password: `admin123`
3. At least one order exists in the database (paid/confirmed status)

---

## Test Sequence

### **TEST 0: Get Admin Token**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "...",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

Save the token for use in subsequent requests.

---

### **TEST 1: Create Shipment**
```bash
curl -X POST http://localhost:4000/api/shiprocket/create-shipment \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
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

**Expected Response:**
```json
{
  "success": true,
  "message": "Shipment created successfully in Shiprocket",
  "data": {
    "shipmentId": "123456789",
    "orderId": "...",
    "status": "pending_courier_assignment"
  }
}
```

---

### **TEST 2: Get Pickup Locations**
```bash
curl -X GET http://localhost:4000/api/shiprocket/pickup-locations \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "pickupLocations": [
      {
        "pickupLocationId": "12345",
        "name": "Primary",
        "address": "123 Warehouse Street",
        "city": "Mumbai",
        "phone": "9876543210"
      }
    ]
  }
}
```

---

### **TEST 3: Get Recommended Couriers**
```bash
curl -X GET "http://localhost:4000/api/shiprocket/recommended-couriers/ORDER_ID_HERE?orderType=regular" \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "couriers": [
      {
        "id": 1,
        "name": "Delhivery",
        "freight": 45.50,
        "estimatedDeliveryDays": 3,
        "rating": 4.5,
        "etd": "2025-01-15"
      },
      {
        "id": 2,
        "name": "Fedex",
        "freight": 65.00,
        "estimatedDeliveryDays": 2,
        "rating": 4.8,
        "etd": "2025-01-14"
      }
    ]
  }
}
```

---

### **TEST 4: Assign Courier (Auto-select Cheapest)**
```bash
curl -X POST http://localhost:4000/api/shiprocket/assign-courier \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
    "orderType": "regular"
  }'
```

**Or with specific courier:**
```bash
curl -X POST http://localhost:4000/api/shiprocket/assign-courier \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
    "orderType": "regular",
    "courierId": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Courier assigned and AWB generated successfully",
  "data": {
    "awbCode": "AWB1234567890",
    "courierName": "Delhivery",
    "shipmentId": "123456789"
  }
}
```

---

### **TEST 5: Request Pickup**
```bash
curl -X POST http://localhost:4000/api/shiprocket/request-pickup \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
    "orderType": "regular"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pickup requested successfully",
  "data": {
    "shipmentId": "123456789",
    "awbCode": "AWB1234567890",
    "pickupScheduled": "2025-01-14T10:00:00Z"
  }
}
```

---

### **TEST 6: Generate Shipping Label**
```bash
curl -X POST http://localhost:4000/api/shiprocket/generate-label \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
    "orderType": "regular"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Shipping label generated successfully",
  "data": {
    "shipmentId": "123456789",
    "awbCode": "AWB1234567890",
    "labelUrl": "https://cdn.shiprocket.in/...",
    "labelFileType": "pdf"
  }
}
```

---

### **TEST 7: Generate Manifest**
```bash
curl -X POST http://localhost:4000/api/shiprocket/generate-manifest \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
    "orderType": "regular"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Manifest generated successfully",
  "data": {
    "manifestUrl": "https://cdn.shiprocket.in/...",
    "shipmentCount": 1
  }
}
```

---

### **TEST 8: Check Serviceability (No Auth Required)**
```bash
curl -X GET "http://localhost:4000/api/shiprocket/check-serviceability?pickupPincode=400001&deliveryPincode=110001"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "serviceability": true,
    "couriers": [
      {
        "id": 1,
        "name": "Delhivery",
        "deliveryTime": "2-3 Days"
      }
    ]
  }
}
```

---

## Using Postman Collection

If you have the `postman_shiprocket_collection.json` file, you can:

1. Open Postman
2. Import `backend/postman_shiprocket_collection.json`
3. Set up environment variables:
   - `baseUrl`: `http://localhost:4000/api`
   - `adminToken`: (obtained from Test 0)
   - `orderId`: (from a confirmed order)
4. Run the tests in sequence

---

## Environment Setup

Ensure `.env` has these variables set:
```env
SHIPROCKET_EMAIL=your-shiprocket-email@example.com
SHIPROCKET_PASSWORD=your-shiprocket-password
SHIPROCKET_API_BASE_URL=https://apiv2.shiprocket.in/v1/external
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Token is invalid or expired. Get a new token from Test 0 |
| 404 Order not found | Make sure the ORDER_ID exists and is confirmed/paid |
| "Shipment already created" | Order already has a shipment. Use a different order |
| "No couriers available" | Pincode may not be serviceable by any courier |
| Connection refused | Server is not running. Run `npm run dev` |

