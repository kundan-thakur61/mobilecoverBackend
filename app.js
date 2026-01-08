const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const { resolveUploadsDir, defaultUploadsPath } = require('./utils/uploadsDir');

const uploadsDir = resolveUploadsDir();



// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const customRoutes = require('./routes/custom');
const uploadRoutes = require('./routes/uploads');
const customDesignRoutes = require('./routes/customDesigns');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');
const wishlistRoutes = require('./routes/wishlist');
const mobileRoutes = require('./routes/mobile');
const collectionRoutes = require('./routes/collections');
const deliveryOneRoutes = require('./routes/deliveryOne');

const app = express();

// Short-circuit and log requests for missing/undefined upload paths (bots or bad clients)
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/undefined') || req.path.startsWith('/api/uploads/undefined')) {
    logger.warn(`Blocked request to ${req.path} - referer=${req.get('referer') || req.get('referrer') || ''} ua=${req.get('user-agent') || ''}`);
    return res.status(404).send('Not Found');
  }
  return next();
});
const frontendBuildPath = path.join(__dirname, '../frontend/dist');

// Render and other managed hosts sit behind a proxy and forward client IPs
// via X-Forwarded-* headers. Enabling trust proxy ensures downstream
// middleware such as express-rate-limit reads the correct IP instead of
// throwing validation errors when those headers are present.
app.set('trust proxy', 1);

// GZIP/Brotli compression for all responses - HUGE performance boost
app.use(compression({
  level: 6, // Balanced compression level (1-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't accept encoding
    if (req.headers['x-no-compression']) return false;
    // Compress all text-based responses
    return compression.filter(req, res);
  }
}));

// Serve static files for uploads (accessible via both /uploads and /api/uploads for dev proxying)
// With aggressive caching for performance
const uploadStaticDirs = [uploadsDir];
if (path.resolve(uploadsDir) !== path.resolve(defaultUploadsPath)) {
  uploadStaticDirs.push(defaultUploadsPath);
}

// Static file options with caching
const staticOptions = {
  maxAge: '1y',           // Cache for 1 year (images rarely change)
  etag: true,             // Enable ETags for validation
  lastModified: true,     // Include Last-Modified header
  immutable: true,        // Mark as immutable for CDN caching
};

uploadStaticDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    app.use(['/uploads', '/api/uploads'], express.static(dir, staticOptions));
  }
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://coverghar.in',
  'https://www.coverghar.in'
];
const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsWhitelist = Array.from(new Set([
  ...defaultAllowedOrigins,
  ...envAllowedOrigins
]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in whitelist
    if (corsWhitelist.includes(origin)) return callback(null, true);
    
    // Allow all Vercel preview deployments (*.vercel.app)
    if (origin.includes('.vercel.app')) return callback(null, true);
    
    // Reject all other origins
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Disable ETag generation for API responses to avoid 304 Not Modified
// responses being returned by Express when clients send conditional
// requests. We also set no-store cache headers for API routes so
// APIs always return fresh 200 responses.
app.set('etag', false);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});
// Rate limiting (centralized in middleware/rateLimiter)
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/payment', require('./routes/paymentRoutes'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/custom', customRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/custom-designs', customDesignRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/deliveryone', deliveryOneRoutes);



// Root endpoint - API information
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Mobile Cover E-commerce API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      custom: '/api/custom',
      customDesigns: '/api/custom-designs',
      uploads: '/api/uploads',
      wishlist: '/api/wishlist',
      mobile: '/api/mobile',
      collections: '/api/collections',
      deliveryone: '/api/deliveryone',
      admin: '/api/admin',
      webhooks: '/api/webhooks'
    },
    documentation: 'See README.md for API documentation'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve the built React app for any non-API route
// With aggressive caching for hashed assets
if (fs.existsSync(frontendBuildPath)) {
  // Assets with hashes in filename - cache for 1 year
  app.use('/assets', express.static(path.join(frontendBuildPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
    etag: true,
  }));

  // Main build files - short cache for HTML (SPA routing)
  app.use(express.static(frontendBuildPath, {
    maxAge: '1h',
    etag: true,
    index: false, // Don't serve index.html for directory requests
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  logger.warn(`Frontend build not found at ${frontendBuildPath}. Skipping static serve.`);
}

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
