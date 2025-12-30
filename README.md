# Mobile Cover E-commerce Backend

A complete Node.js backend for a custom mobile cover e-commerce platform with authentication, product management, order processing, custom design uploads, and payment integration.

## Features

- 🔐 **Secure Authentication** - JWT-based authentication with role-based access control
- 📱 **Product Management** - CRUD operations for products with variants
- 🛒 **Order System** - Complete order processing with Razorpay integration
- 🎨 **Custom Designs** - Upload and manage custom mobile cover designs
- 💳 **Payment Processing** - Razorpay integration with webhook support
- � **Shipping Integration** - Shiprocket API integration for automated shipping and tracking
- �📊 **Admin Panel** - Comprehensive admin dashboard for order management
- 🖼️ **Image Uploads** - Cloudinary integration for image storage
- 🧪 **Testing** - Comprehensive test suite with Jest
- 📚 **Documentation** - Complete API documentation with Postman collection

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Razorpay** - Payment gateway
- **Cloudinary** - Image storage
- **Multer** - File upload handling
- **Shiprocket** - Shipping and logistics integration
- **Winston** - Logging
- **Jest & Supertest** - Testing framework

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.0 or higher)
- Cloudinary account
- Razorpay account
- Shiprocket account (for shipping features)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mobile-cover-ecommerce-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Server Configuration
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/mobile-cover-ecommerce

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Razorpay Configuration
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
```

5. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/address` - Add shipping address
- `DELETE /api/auth/address/:id` - Delete address

### Products
- `GET /api/products` - Get all products (with filtering, sorting, pagination)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin only)
- `PUT /api/products/:id` - Update product (Admin only)
- `DELETE /api/products/:id` - Delete product (Admin only)

### Orders
- `POST /api/orders` - Create new order
- `POST /api/orders/pay/create` - Create Razorpay order
- `POST /api/orders/pay/verify` - Verify payment
- `GET /api/orders/my` - Get user's orders
- `GET /api/orders/:id` - Get single order
- `PUT /api/orders/:id/cancel` - Cancel order

### Custom Orders
- `POST /api/custom/order` - Create custom order (productId is optional; if absent provide variant.price or an explicit price in the payload)
- `POST /api/custom/pay` - Create payment for custom order
- `POST /api/custom/pay/verify` - Verify custom payment
- `GET /api/custom/orders` - Get user's custom orders
- `GET /api/custom/orders/:id` - Get single custom order

### Uploads
- `POST /api/uploads/image` - Upload multiple images
- `POST /api/uploads/base64` - Upload base64 image
- `POST /api/uploads/product/:productId/variant/:variantId` - Upload product image (Admin)
- `POST /api/uploads/mockup/:productId` - Upload mockup template (Admin)
- `DELETE /api/uploads/:publicId` - Delete uploaded image

### Admin
- `GET /api/admin/orders` - Get all orders (Admin)
- `PUT /api/admin/orders/:id/status` - Update order status (Admin)
- `GET /api/admin/custom-orders` - Get all custom orders (Admin)
- `PUT /api/admin/custom/:id/approve` - Approve custom order (Admin)
- `PUT /api/admin/custom/:id/reject` - Reject custom order (Admin)
- `PUT /api/admin/custom/:id/status` - Update custom order status (Admin)

### Mobile (Companies & Models)

- `GET /api/mobile/companies` - List public mobile companies
- `GET /api/mobile/models` - List public mobile models (accepts company filter)

Admin-only endpoints for managing mobile data:

- `GET /api/admin/mobile/companies` - Admin list companies
- `POST /api/admin/mobile/companies` - Create company (Admin)
- `PUT /api/admin/mobile/companies/:id` - Update company (Admin)
- `DELETE /api/admin/mobile/companies/:id` - Delete company (Admin)

- `GET /api/admin/mobile/models` - Admin list models
- `POST /api/admin/mobile/models` - Create model (Admin)
- `PUT /api/admin/mobile/models/:id` - Update model (Admin)
- `DELETE /api/admin/mobile/models/:id` - Delete model (Admin)

### Theme management

Site themes can be created and activated via admin endpoints. Themes are stored with CSS variable mappings so the frontend can apply them at runtime.

- `GET /api/admin/themes` - List themes (Admin)
- `POST /api/admin/themes` - Create theme (Admin). Body: { name, key, variables } — variables should be key/value pairs of CSS variables (e.g. { "--bg": "#fff" })
- `PUT /api/admin/themes/:id` - Update theme (Admin)
- `DELETE /api/admin/themes/:id` - Delete theme (Admin)
- `PUT /api/admin/themes/:id/activate` - Mark theme as active (Admin)

Public endpoint to fetch active theme for clients:

- `GET /api/mobile/themes/active` - Get currently active theme (public)

### Webhooks
- `POST /api/webhooks/razorpay` - Razorpay webhook endpoint

### Shiprocket (Shipping)
**Public Endpoints:**
- `GET /api/shiprocket/track/:orderId` - Track shipment (authenticated users)
- `GET /api/shiprocket/check-serviceability` - Check delivery serviceability

**Admin Endpoints:**
- `POST /api/shiprocket/create-shipment` - Create shipment in Shiprocket
- `POST /api/shiprocket/assign-courier` - Assign courier and generate AWB
- `GET /api/shiprocket/recommended-couriers/:orderId` - Get available couriers
- `POST /api/shiprocket/request-pickup` - Request courier pickup
- `POST /api/shiprocket/cancel-shipment` - Cancel shipment
- `POST /api/shiprocket/generate-label` - Generate shipping label
- `POST /api/shiprocket/generate-manifest` - Generate manifest for multiple orders
- `GET /api/shiprocket/pickup-locations` - Get configured pickup locations

**Webhook:**
- `POST /api/shiprocket/webhook` - Receive status updates from Shiprocket

See [SHIPROCKET_INTEGRATION.md](./SHIPROCKET_INTEGRATION.md) for detailed documentation.

## Testing

Run the test suite:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Database Schema

### User
```javascript
{
  name: String,
  email: String (unique),
  passwordHash: String,
  role: String ('user' | 'admin'),
  addresses: Array,
  phone: String,
  isActive: Boolean,
  emailVerified: Boolean
}
```

### Product
```javascript
{
  title: String,
  brand: String,
  model: String,
  type: String ('Glossy Metal' | 'Glossy Metal + Gel'),
  description: String,
  variants: Array,
  mockupTemplateUrl: String,
  category: String,
  isActive: Boolean,
  featured: Boolean
}
```

### Order
```javascript
{
  userId: ObjectId,
  items: Array,
  total: Number,
  shippingAddress: Object,
  payment: Object,
  status: String,
  trackingNumber: String
}
```

### CustomOrder
```javascript
{
  userId: ObjectId,
  productId: ObjectId,
  variant: Object,
  quantity: Number,
  imageUrls: Array,
  mockupUrl: String,
  instructions: String,
  price: Number,
  payment: Object,
  status: String,
  adminNotes: String
}
```

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcryptjs with salt rounds >= 10
- **Input Validation** - Express-validator for all endpoints
- **Rate Limiting** - Protection against brute force attacks
- **CORS Protection** - Configured for cross-origin requests
- **Helmet** - Security headers
- **File Upload Limits** - 5MB per file, image types only
- **EXIF Stripping** - Remove metadata from uploaded images

## Payment Flow

1. **Order Creation**: Client creates order on backend
2. **Razorpay Order**: Backend creates Razorpay order and returns order ID
3. **Payment**: Client completes payment using Razorpay checkout
4. **Verification**: Client sends payment details to backend for verification
5. **Webhook**: Razorpay sends webhook notification for final confirmation
6. **Order Update**: Backend updates order status and reduces stock

## Custom Order Workflow

1. **Image Upload**: User uploads custom image
2. **Design Creation**: User creates design using mockup template
3. **Order Creation**: User places custom order
4. **Admin Review**: Admin reviews and approves/rejects design
5. **Production**: Approved orders go into production
6. **Shipping**: Order is shipped to customer

## Deployment

### Using Docker
```bash
docker build -t mobile-cover-backend .
docker run -p 4000:4000 --env-file .env mobile-cover-backend
```

### Using PM2
```bash
npm install -g pm2
pm2 start index.js --name mobile-cover-backend
pm2 startup
pm2 save
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use production MongoDB URI
- Configure proper CORS origins
- Set up SSL certificates
- Configure monitoring and logging

## Razorpay Webhook Configuration

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/razorpay`
3. Set webhook secret in environment variables
4. Select events: `payment.captured`, `payment.failed`, `refund.created`, `refund.failed`

## Cloudinary Configuration

1. Create Cloudinary account
2. Get API credentials from dashboard
3. Configure upload presets for automatic optimization
4. Set up folder structure for organized storage

## API Documentation

Import the provided Postman collection (`postman_collection.json`) for complete API documentation with example requests.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed description
4. Contact support@example.com

## Changelog

### v1.0.0
- Initial release
- Complete authentication system
- Product management
- Order processing
- Custom design uploads
- Payment integration
- Admin panel
- Comprehensive testing