const Sentry = require('@sentry/node');
const logger = require('./logger');

/**
 * Initialize Sentry error tracking for the backend
 * Only initializes in production or if explicitly enabled
 */
const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  
  if (!dsn) {
    if (environment === 'production') {
      logger.warn('Sentry DSN not configured. Error tracking disabled.');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release: process.env.npm_package_version || '1.0.0',
    
    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    // Only send errors in production by default
    enabled: environment === 'production' || process.env.SENTRY_ENABLED === 'true',
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      
      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data?.password) {
            breadcrumb.data.password = '[REDACTED]';
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
    
    // Ignore common non-actionable errors
    ignoreErrors: [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED',
      /^Network request failed$/,
      /^Rate limit exceeded$/,
    ],
  });

  logger.info(`Sentry initialized for ${environment} environment`);
};

/**
 * Capture an exception with additional context
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 */
const captureException = (error, context = {}) => {
  if (!process.env.SENTRY_DSN) {
    logger.error('Error captured (Sentry disabled):', error.message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context.user) {
      scope.setUser({
        id: context.user.id || context.user._id,
        email: context.user.email,
      });
    }

    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
};

/**
 * Capture a message with severity level
 * @param {string} message - The message to capture
 * @param {string} level - Severity level (fatal, error, warning, info, debug)
 */
const captureMessage = (message, level = 'info') => {
  if (!process.env.SENTRY_DSN) {
    logger.log(level, `Message captured (Sentry disabled): ${message}`);
    return;
  }

  Sentry.captureMessage(message, level);
};

/**
 * Express error handler middleware for Sentry
 * In Sentry SDK v8+, we use setupExpressErrorHandler or a custom middleware
 */
const sentryErrorHandler = (err, req, res, next) => {
  // Only capture server errors
  const status = err.status || err.statusCode || 500;
  if (status >= 500 || status === 429) {
    Sentry.captureException(err, {
      extra: {
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query,
      },
    });
  }
  next(err);
};

/**
 * Express request handler middleware for Sentry
 * Adds request context to Sentry scope
 */
const sentryRequestHandler = (req, res, next) => {
  Sentry.withScope((scope) => {
    scope.setTag('url', req.url);
    scope.setTag('method', req.method);
    if (req.user) {
      scope.setUser({
        id: req.user.id || req.user._id,
        email: req.user.email,
      });
    }
  });
  next();
};

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  sentryErrorHandler,
  sentryRequestHandler,
  Sentry,
};
