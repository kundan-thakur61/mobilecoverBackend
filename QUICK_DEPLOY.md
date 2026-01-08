# 🚀 Quick Deployment Guide - DeliveryOne Webhook

## ✅ What's Done
- DeliveryOne webhook endpoint created at `/api/webhooks/deliveryone`
- Deployment configuration files added
- Code pushed to GitHub

## 📋 Next Steps (Choose One)

### Option 1: Deploy to Render.com (Recommended - Free HTTPS)

1. **Go to Render Dashboard**
   - Visit: https://render.com
   - Sign in with GitHub

2. **Create New Web Service**
   - Click **"New +"** → **"Web Service"**
   - Select repository: `kundan-thakur61/s-backend`
   - Click **"Connect"**

3. **Configure Service**
   - **Name**: `copadmob-backend`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Root Directory**: Leave blank (or type `backend` if it's a monorepo)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Add Environment Variables**
   Click **"Advanced"** → **"Add Environment Variable"**
   
   Copy-paste these (update values if needed):
   
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://coverghar_db_user:hXebSutObXfQMZNn@cluster0.cjcldrv.mongodb.net/coverghar
   JWT_SECRET=asdertyhgfcvbgjmloiuybmlphgcdgbn
   CLOUDINARY_CLOUD_NAME=dwmytphop
   CLOUDINARY_API_KEY=175649898342853
   CLOUDINARY_API_SECRET=ue8YHB5bfYlwTOwHlmLouWs5l6I
   RAZORPAY_KEY_ID=rzp_test_RHMsrxS6rQOzrE
   RAZORPAY_KEY_SECRET=b263TG9jMqFP4P2cJ7KOtfTx
   DELIVERYONE_EMAIL=tanukumar006566@gmail.com
   DELIVERYONE_PASSWORD=qY&OXb9AsnvSou7vLSdAxsWaf$JMQr1E
   DELIVERYONE_API_BASE_URL=https://api.deliveryone.com/v1
   DELIVERYONE_WEBHOOK_SECRET=your-secret-deliveryone-webhook-token-12345
   DELIVERYONE_AUTO_CREATE=true
   FRONTEND_URL=https://coverghar.in
   CORS_ALLOWED_ORIGINS=https://coverghar.in,https://www.coverghar.in
   ```

5. **Deploy**
   - Click **"Create Web Service"**
   - Wait 3-5 minutes
   - Copy your URL (e.g., `https://copadmob-backend.onrender.com`)

6. **Update DeliveryOne**
   - Go to: https://app.deliveryone.com/sellers/settings/additional-settings/webhooks
   - **URL**: `https://copadmob-backend.onrender.com/api/webhooks/deliveryone`
   - **Token**: `your-secret-deliveryone-webhook-token-12345`
   - Click **"Save"**

---

### Option 2: Deploy to Railway.app (Also Free)

```bash
npm i -g @railway/cli
railway login
cd backend
railway init
railway up
```

Get your URL from Railway dashboard and use it in DeliveryOne.

---

## 🧪 Test Your Webhook

After deployment, test it:

```bash
cd backend
WEBHOOK_BASE_URL=https://your-render-url.onrender.com node scripts/testDeliveryOneWebhook.js shipped
```

---

## 📝 Important Notes

1. **Free Tier Sleep**: Render free tier spins down after 15 minutes of inactivity
2. **First Request Delay**: ~30 seconds after sleep
3. **Upgrade**: $7/month for always-on service
4. **Auto-Deploy**: Every `git push` triggers auto-deployment

---

## 🆘 Troubleshooting

### "Address is not allowed" Error
- Ensure URL starts with `https://`
- URL must be publicly accessible
- Check if Render service is running

### "Unauthorized" Error
- Verify token matches `DELIVERYONE_WEBHOOK_SECRET` in env vars

### 500 Error
- Check Render logs for errors
- Verify MongoDB connection string

---

## 📚 Files Created

- `backend/render.yaml` - Render deployment config
- `backend/DEPLOYMENT.md` - Full deployment guide
- `backend/ENV_VARIABLES.md` - Environment variables reference
- `backend/scripts/testDeliveryOneWebhook.js` - Test script

---

## ✨ Your Webhook Endpoint

After deployment, your webhook will be at:

```
https://[your-service-name].onrender.com/api/webhooks/deliveryone
```

This endpoint handles:
- ✅ Shipment status updates
- ✅ Delivery tracking
- ✅ RTO notifications
- ✅ Cancellation events
