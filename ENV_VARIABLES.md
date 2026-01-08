# Environment Variables Configuration

## Required Environment Variables

Copy `.env.example` to `.env` and configure:

### Server Configuration
```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Database
```env
MONGO_URI=mongodb+srv://your-user:your-password@cluster.mongodb.net/your-db
```

### JWT Authentication
```env
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
```

### Cloudinary (Image Upload)
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Razorpay (Payment Gateway)
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

### DeliveryOne (Shipping)
```env
DELIVERYONE_EMAIL=your-deliveryone-email@example.com
DELIVERYONE_PASSWORD=your-deliveryone-password
DELIVERYONE_API_BASE_URL=https://api.deliveryone.com/v1
DELIVERYONE_WEBHOOK_SECRET=your-random-secret-token
DELIVERYONE_AUTO_CREATE=true
```

### Webhook Configuration
```env
# For local development with ngrok
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok-free.app

# For production
WEBHOOK_BASE_URL=https://your-domain.com
```

### Email (Optional)
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Logging
```env
LOG_LEVEL=info
```

### CORS Configuration
```env
CORS_ALLOWED_ORIGINS=https://coverghar.in,https://www.coverghar.in
```

---

## Production Environment Setup

### Render.com
All environment variables are set in the Render dashboard under **Environment** tab.

### Railway.app
```bash
railway variables set KEY=value
```

### Vercel
```bash
vercel env add KEY production
```

---

## Security Notes

1. **Never commit `.env` to Git**
2. Use strong random strings for secrets
3. Rotate secrets regularly
4. Use different credentials for dev/staging/production
5. Enable 2FA on all third-party services

---

## Generate Secure Secrets

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Webhook Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment-Specific Values

### Development
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok-free.app
```

### Production
```env
NODE_ENV=production
FRONTEND_URL=https://coverghar.in
WEBHOOK_BASE_URL=https://api.coverghar.in
```

---

## Webhook URLs

### Razorpay Webhook
Set in Razorpay Dashboard:
```
https://your-domain.com/api/webhooks/razorpay
```

### DeliveryOne Webhook
Set in DeliveryOne Dashboard:
```
https://your-domain.com/api/webhooks/deliveryone
```

---

## Verification Checklist

- [ ] All required variables are set
- [ ] No hardcoded secrets in code
- [ ] `.env` is in `.gitignore`
- [ ] Production uses different credentials than dev
- [ ] Webhook secrets are unique and random
- [ ] HTTPS URLs for production webhooks
- [ ] CORS origins include production domain
