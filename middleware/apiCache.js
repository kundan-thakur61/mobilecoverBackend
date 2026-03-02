/**
 * API Response Cache Middleware
 * 
 * In-memory cache for frequently-hit read-only API endpoints to reduce
 * TTFB and database load. Used for collection listings, product listings,
 * and other public GET endpoints.
 */

const logger = require('../utils/logger');

// Simple in-memory cache store
const cache = new Map();

// Default TTL: 5 minutes (300 seconds)
const DEFAULT_TTL = 300;

/**
 * Cache middleware factory
 * @param {number} ttlSeconds - Cache Time-To-Live in seconds
 * @returns {Function} Express middleware
 */
function apiCache(ttlSeconds = DEFAULT_TTL) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = `__api_cache__${req.originalUrl || req.url}`;
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiry) {
      // Set cache-related headers
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds * 2}, stale-while-revalidate=${ttlSeconds}`);
      return res.status(cached.status).json(cached.body);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, {
          body,
          status: res.statusCode,
          expiry: Date.now() + (ttlSeconds * 1000),
        });

        // Evict oldest entries if cache grows too large (500 entries max)
        if (cache.size > 500) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
      }

      res.set('X-Cache', 'MISS');
      res.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds * 2}, stale-while-revalidate=${ttlSeconds}`);
      return originalJson(body);
    };

    next();
  };
}

/**
 * Clear all cached entries (call after data mutations)
 */
function clearCache() {
  cache.clear();
  logger.info('API cache cleared');
}

/**
 * Clear cache entries matching a URL prefix
 * @param {string} prefix - URL prefix to match
 */
function clearCacheByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.includes(prefix)) {
      cache.delete(key);
    }
  }
}

module.exports = { apiCache, clearCache, clearCacheByPrefix };
