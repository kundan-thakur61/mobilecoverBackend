/**
 * Database Query Optimization Utilities
 * 
 * Performance tips for MongoDB queries:
 * 1. Always use .lean() for read-only queries - 3-5x faster
 * 2. Select only needed fields with .select()
 * 3. Use pagination with skip/limit
 * 4. Index frequently queried fields
 * 5. Avoid using $ne, $nin, $not as they don't use indexes
 */

const logger = require('./logger');

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute default

/**
 * Get item from cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null
 */
const getFromCache = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
};

/**
 * Set item in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in ms (default 1 min)
 */
const setInCache = (key, value, ttl = CACHE_TTL) => {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl,
  });
};

/**
 * Clear cache entry or all cache
 * @param {string} key - Optional key to clear
 */
const clearCache = (key = null) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};

/**
 * Optimized paginated query helper
 * @param {Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} options - Query options
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
const paginatedQuery = async (Model, filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    select = '',
    populate = [],
    lean = true,
    cacheKey = null,
    cacheTTL = CACHE_TTL,
  } = options;

  // Check cache first
  if (cacheKey) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }
  }

  const skip = (page - 1) * limit;

  // Build query
  let query = Model.find(filter);
  
  if (select) query = query.select(select);
  if (populate.length) {
    populate.forEach(p => {
      query = query.populate(p);
    });
  }
  
  query = query.sort(sort).skip(skip).limit(limit);
  
  // Use lean for read-only queries (3-5x faster)
  if (lean) query = query.lean();

  // Execute query and count in parallel
  const [data, total] = await Promise.all([
    query.exec(),
    Model.countDocuments(filter),
  ]);

  const result = {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };

  // Cache result
  if (cacheKey) {
    setInCache(cacheKey, result, cacheTTL);
  }

  return result;
};

/**
 * Optimized single document query
 * @param {Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} options - Query options
 * @returns {Promise<Object|null>}
 */
const findOneOptimized = async (Model, filter, options = {}) => {
  const {
    select = '',
    populate = [],
    lean = true,
    cacheKey = null,
    cacheTTL = CACHE_TTL,
  } = options;

  // Check cache first
  if (cacheKey) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let query = Model.findOne(filter);
  
  if (select) query = query.select(select);
  if (populate.length) {
    populate.forEach(p => {
      query = query.populate(p);
    });
  }
  if (lean) query = query.lean();

  const result = await query.exec();

  if (cacheKey && result) {
    setInCache(cacheKey, result, cacheTTL);
  }

  return result;
};

/**
 * Bulk operation helper for better performance
 * @param {Model} Model - Mongoose model
 * @param {Array} operations - Array of bulk operations
 * @returns {Promise<Object>}
 */
const bulkWrite = async (Model, operations) => {
  if (!operations.length) return { modifiedCount: 0 };
  
  const result = await Model.bulkWrite(operations, { ordered: false });
  
  logger.info(`Bulk write completed: ${result.modifiedCount} modified`);
  return result;
};

/**
 * Query performance analyzer (for development)
 * @param {Query} query - Mongoose query
 * @param {string} label - Label for logging
 * @returns {Promise<any>}
 */
const analyzeQuery = async (query, label = 'Query') => {
  const start = Date.now();
  const result = await query.exec();
  const duration = Date.now() - start;
  
  if (duration > 100) {
    logger.warn(`Slow query [${label}]: ${duration}ms`);
  } else {
    logger.debug(`Query [${label}]: ${duration}ms`);
  }
  
  return result;
};

/**
 * Create indexes for a model (run on app startup)
 * @param {Model} Model - Mongoose model
 * @param {Array} indexes - Array of index definitions
 */
const ensureIndexes = async (Model, indexes) => {
  try {
    for (const index of indexes) {
      await Model.collection.createIndex(index.fields, index.options || {});
    }
    logger.info(`Indexes created for ${Model.modelName}`);
  } catch (error) {
    logger.error(`Failed to create indexes for ${Model.modelName}:`, error);
  }
};

module.exports = {
  getFromCache,
  setInCache,
  clearCache,
  paginatedQuery,
  findOneOptimized,
  bulkWrite,
  analyzeQuery,
  ensureIndexes,
  CACHE_TTL,
};
