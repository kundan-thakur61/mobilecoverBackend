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
    adminRateLimiter: noop
  };
} else {
  const rateLimit = require('express-rate-limit');

  // Strict rate limiter for admin endpoints
  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 admin requests per windowMs
    message: {
      success: false,
      message: 'Too many admin requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  module.exports = {
    adminRateLimiter
  };
}
