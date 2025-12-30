const noop = (req, res, next) => next();

const shouldDisableRateLimit = (() => {
  const env = process.env.NODE_ENV;
  if (env === 'test') return true;
  if (env === 'development' && process.env.ENABLE_RATE_LIMIT !== 'true') return true;
  if (process.env.DISABLE_RATE_LIMIT === 'true') return true;
  return false;
})();

if (shouldDisableRateLimit) {
  module.exports = {
    generalLimiter: noop,
    authLimiter: noop,
    uploadLimiter: noop,
    orderLimiter: noop
  };
} else {
  const rateLimit = require('express-rate-limit');

  // General rate limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Strict rate limiter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
  });

  // Rate limiter for upload endpoints
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 uploads per hour
    message: {
      success: false,
      message: 'Too many upload requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limiter for order creation
  const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 orders per hour
    message: {
      success: false,
      message: 'Too many order requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  module.exports = {
    generalLimiter,
    authLimiter,
    uploadLimiter,
    orderLimiter
  };
}