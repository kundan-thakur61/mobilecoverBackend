# Shiprocket Setup Checklist

## ✅ Step 1: Add Shiprocket Credentials to .env

**Status: READY TO CONFIGURE**

Your `.env` file has been updated with Shiprocket configuration placeholders.

**Action Required:**
1. Get your Shiprocket credentials:
   - Go to https://app.shiprocket.in/
   - Sign up or login
   - Navigate to **Settings → API**
   
2. Update your `.env` file:
   ```env
   SHIPROCKET_EMAIL=your-actual-email@example.com
   SHIPROCKET_PASSWORD=your-actual-password
   ```

3. Verify configuration:
   ```bash
   npm run test:shiprocket
   ```

---

## ✅ Step 2: Test the Integration

**Test Scripts Created:**

### 2a. Basic Integration Test
Tests authentication, pickup locations, and serviceability:
```bash
cd backend
npm run test:shiprocket
```

This will:
- ✅ Authenticate with Shiprocket API
- ✅ Fetch your pickup locations
- ✅ Check serviceability for sample pincodes
- ✅ Show available couriers

### 2b. Create Sample Shipment
Test creating an actual shipment:

**Option 1: With a real order from database**
```bash
npm run test:shipment <orderId>
```

**Option 2: With sample test data**
```bash
npm run test:shipment
```

This will:
- ✅ Create a test shipment in Shiprocket
- ✅ Fetch available couriers
- ✅ Auto-assign cheapest courier
- ✅ Generate AWB code
- ✅ Provide tracking link

### 2c. Test via API (Manual)

Start your server:
```bash
npm run dev
```

Then test endpoints:

**Check Serviceability:**
```bash
curl "http://localhost:4000/api/shiprocket/check-serviceability?pickupPincode=400001&deliveryPincode=110001"
```

**Create Shipment (requires admin token):**
```bash
curl -X POST http://localhost:4000/api/shiprocket/create-shipment \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "orderType": "regular"
  }'
```

---

## ✅ Step 3: Configure Webhook URL in Shiprocket Dashboard

**Webhook Setup Instructions:**

1. **Deploy your application** (or use ngrok for local testing):
   
   For local testing:
   ```bash
   # Install ngrok: https://ngrok.com/download
   ngrok http 4000
   ```
   This gives you a public URL like: `https://abc123.ngrok.io`

2. **Configure in Shiprocket Dashboard:**
   - Go to https://app.shiprocket.in/
   - Navigate to **Settings → API**
   - Find "Webhook" section
   - Add your webhook URL:
     ```
     https://your-domain.com/api/shiprocket/webhook
     ```
     Or for local testing:
     ```
     https://abc123.ngrok.io/api/shiprocket/webhook
     ```

3. **Select Events to Receive:**
   - ✅ Shipment Pickup
   - ✅ In Transit
   - ✅ Out for Delivery
   - ✅ Delivered
   - ✅ RTO (Return to Origin)
   - ✅ Cancelled

4. **Save Configuration**

5. **Test Webhook:**
   - Create a test shipment
   - Check your server logs for webhook events
   - Status updates will automatically sync to your database

**Webhook Endpoint:**
```
POST /api/shiprocket/webhook
```

**What it does automatically:**
- Updates order status in database
- Syncs tracking information
- Emits real-time updates via Socket.IO
- Handles RTO scenarios

---

## ✅ Step 4: Enable Auto-Creation (Optional)

**Status: CONFIGURED (Disabled by default)**

Auto-creation allows automatic shipment creation when orders are paid.

### To Enable:

Update `.env`:
```env
SHIPROCKET_AUTO_CREATE=true
```

### To Implement in Code:

Add to your `orderController.js` in the `verifyPayment` function:

```javascript
const shiprocketHelper = require('../utils/shiprocketHelper');

// After order payment is confirmed
if (process.env.SHIPROCKET_AUTO_CREATE === 'true') {
  // Non-blocking - won't fail order if Shiprocket fails
  shiprocketHelper.autoCreateShipment(order, {
    orderType: 'regular',
    pickupLocation: 'Primary',
    autoAssignCourier: true,  // Auto-select cheapest courier
    requestPickup: false       // Set true to auto-request pickup
  }).catch(err => {
    logger.error('Auto-shipment creation failed:', err);
  });
}
```

**Configuration Options:**
- `autoAssignCourier: true` - Automatically selects cheapest courier
- `requestPickup: true` - Automatically requests pickup from courier
- `pickupLocation: 'Primary'` - Which warehouse to ship from

**When to use:**
- ✅ Small items with fixed dimensions
- ✅ High order volume
- ✅ Fast shipping required

**When NOT to use:**
- ❌ Custom products needing review
- ❌ Variable package sizes
- ❌ Manual quality checks required

---

## ✅ Step 5: Monitor Logs

**Logging is configured and ready!**

### View Logs:

**Development (console):**
```bash
npm run dev
```
All Shiprocket operations will be logged to console.

**Production (files):**
Logs are written to `backend/logs/` directory.

### What Gets Logged:

**✅ Authentication:**
```
Shiprocket authentication successful
```

**✅ Shipment Creation:**
```
Shiprocket order created: { orderId: '...', shipmentId: 12345, orderId: 98765 }
```

**✅ Courier Assignment:**
```
Auto-selected courier: { courierId: 1, courierName: 'Delhivery', freight: 45.50 }
AWB generated: { orderId: '...', awbCode: 'AWB...' }
```

**✅ Webhook Events:**
```
Shiprocket webhook received: { order_id: 'ORD-...', current_status: 'shipped' }
```

**❌ Errors:**
```
Failed to auto-create Shiprocket shipment: { orderId: '...', error: '...' }
```

### Monitor Real-time:

**Watch logs in development:**
```bash
cd backend
npm run dev
```

**Filter Shiprocket logs:**
```bash
# On Linux/Mac:
npm run dev | grep -i shiprocket

# On Windows PowerShell:
npm run dev | Select-String "shiprocket"
```

**Production log files:**
```bash
# View latest errors
tail -f backend/logs/error.log

# View all logs
tail -f backend/logs/combined.log
```

### What to Monitor:

1. **Authentication Success**
   - Should happen once on server start
   - Token refreshes automatically after 9 days

2. **Shipment Creation**
   - Watch for successful `shipment_id` and `order_id`
   - Check for AWB code generation

3. **Webhook Reception**
   - Verify status updates are received
   - Check database is being updated

4. **Errors to Watch For:**
   - Authentication failures (check credentials)
   - No couriers available (check serviceability)
   - Invalid addresses (check order data)

---

## 🎯 Quick Start Summary

1. **Add credentials to .env**
   ```env
   SHIPROCKET_EMAIL=your@email.com
   SHIPROCKET_PASSWORD=yourpassword
   ```

2. **Test basic integration**
   ```bash
   npm run test:shiprocket
   ```

3. **Create sample shipment**
   ```bash
   npm run test:shipment
   ```

4. **Configure webhook** (in Shiprocket dashboard)
   ```
   https://your-domain.com/api/shiprocket/webhook
   ```

5. **Enable auto-creation** (optional)
   ```env
   SHIPROCKET_AUTO_CREATE=true
   ```

6. **Monitor logs**
   ```bash
   npm run dev
   ```

---

## 📚 Additional Resources

- **Full Documentation:** `backend/SHIPROCKET_INTEGRATION.md`
- **Quick Start Guide:** `backend/SHIPROCKET_QUICKSTART.md`
- **API Endpoints:** `backend/README.md`
- **Postman Collection:** `backend/postman_shiprocket_collection.json`

## 🆘 Troubleshooting

**Authentication fails:**
- Verify credentials in `.env`
- Check Shiprocket account is active
- Ensure KYC is completed

**No couriers available:**
- Check if pincodes are serviceable
- Verify pickup location in Shiprocket dashboard
- Check package dimensions

**Webhook not receiving events:**
- Ensure webhook URL is publicly accessible
- Check URL is configured in Shiprocket dashboard
- Verify events are selected

**Need Help?**
- Shiprocket API Docs: https://apidocs.shiprocket.in/
- Shiprocket Support: support@shiprocket.com
- Check application logs for detailed errors
