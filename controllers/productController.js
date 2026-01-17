const Product = require('../models/Product');
const logger = require('../utils/logger');
const { deleteImage } = require('../utils/cloudinary');
const { paginatedQuery, findOneOptimized, clearCache } = require('../utils/queryOptimizer');

const PRODUCTS_CACHE_TTL = 60 * 1000; // 1 minute cache for hot product queries
const PUBLIC_PRODUCTS_CACHE_HEADER = 'public, max-age=60, stale-while-revalidate=300';

// Helper to generate a reasonably-unique SKU
const generateCandidateSku = () => {
  return `SKU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
};

const generateUniqueSku = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const sku = generateCandidateSku();
    const exists = await Product.findOne({ 'variants.sku': sku });
    if (!exists) return sku;
    attempts += 1;
  }
  // fallback to a uuid-like string
  return `SKU-${Date.now()}-${Math.floor(Math.random()*100000)}`;
};

/**
 * Get all products with filtering, sorting, and pagination
 * GET /api/products
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      brand,
      model,
      type,
      category,
      search,
      sort = '-createdAt',
      minPrice,
      maxPrice,
      inStock = true,
      featured,
      trending
    } = req.query;

    // Build query
    const query = { isActive: true };

    if (brand) query.brand = { $regex: brand, $options: 'i' };
    if (model) query.model = { $regex: model, $options: 'i' };
    if (type) query.type = type;
    if (category) query.category = category;
    if (featured === 'true') query.featured = true;
    if (trending === 'true') query.trending = true;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query['variants.price'] = {};
      if (minPrice) query['variants.price'].$gte = parseFloat(minPrice);
      if (maxPrice) query['variants.price'].$lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock === 'true') {
      query['variants.stock'] = { $gt: 0 };
    }

    // Execute query with pagination (lean + cache)
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const cacheKey = `products:${Buffer.from(JSON.stringify({
      query,
      page: pageNum,
      limit: limitNum,
      sort
    })).toString('base64')}`;

    const { data: products, pagination } = await paginatedQuery(Product, query, {
      page: pageNum,
      limit: limitNum,
      sort,
      select: '-mockupTemplatePublicId',
      lean: true,
      cacheKey,
      cacheTTL: PRODUCTS_CACHE_TTL,
    });

    // Filter variants based on stock and active status
    const filteredProducts = products.map(product => {
      const productObj = { ...product };
      productObj.variants = productObj.variants.filter(variant =>
        variant.isActive && variant.stock > 0
      );
      return productObj;
    }).filter(product => product.variants.length > 0);

    res.set('Cache-Control', PUBLIC_PRODUCTS_CACHE_HEADER);
    res.json({
      success: true,
      data: {
        products: filteredProducts,
        pagination: {
          currentPage: pagination.page,
          totalPages: pagination.pages,
          totalProducts: pagination.total,
          hasNext: pagination.hasNext,
          hasPrev: pagination.hasPrev,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single product by ID
 * GET /api/products/:id
 */
const getProduct = async (req, res, next) => {
  try {
    const cacheKey = `product:${req.params.id}`;
    const product = await findOneOptimized(Product, { _id: req.params.id }, {
      select: '-mockupTemplatePublicId',
      lean: true,
      cacheKey,
      cacheTTL: PRODUCTS_CACHE_TTL,
    });
    
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Filter active variants with stock
    const productObj = { ...product };
    productObj.variants = productObj.variants.filter(variant =>
      variant.isActive && variant.stock > 0
    );

    if (productObj.variants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not available'
      });
    }

    res.set('Cache-Control', PUBLIC_PRODUCTS_CACHE_HEADER);
    res.json({
      success: true,
      data: { product: productObj }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new product (Admin only)
 * POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      title,
      brand,
      model,
      type,
      description,
      category,
      tags,
      featured = false,
      trending = false,
      variants // Allow variants in create request
    } = req.body;

    // If variants are provided, ensure SKUs are unique. Auto-generate missing SKUs.
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        if (variant.sku) {
          const existingProduct = await Product.findOne({ 'variants.sku': variant.sku });
          if (existingProduct) {
            return res.status(400).json({
              success: false,
              message: `SKU ${variant.sku} already exists`
            });
          }
        } else {
          // generate a unique sku for this variant
          variant.sku = await generateUniqueSku();
        }
      }
    }

    // Create product
    const product = new Product({
      title,
      brand,
      model,
      type,
      description,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      featured,
      trending,
      variants: variants || [] // Include variants if provided
    });

    await product.save();
    clearCache();

    logger.info('Product created:', { productId: product._id, title: product.title });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product (Admin only)
 * PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const {
      title,
      brand,
      model,
      type,
      description,
      category,
      tags,
      featured,
      trending
    } = req.body;

    const updates = {};
    if (title) updates.title = title;
    if (brand) updates.brand = brand;
    if (model) updates.model = model;
    if (type) updates.type = type;
    if (description) updates.description = description;
    if (category) updates.category = category;
    if (featured !== undefined) updates.featured = featured;
    if (trending !== undefined) updates.trending = trending;
    if (tags) updates.tags = tags.split(',').map(tag => tag.trim());

      // Find product first to allow variant updates/merging
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Apply top-level updates
      Object.assign(product, updates);

      // Support updating/adding variants in the same request
      // Expect `variants` to be an array of variant objects. Each variant may include `_id` to update.
      if (req.body.variants && Array.isArray(req.body.variants)) {
        for (const v of req.body.variants) {
          // New variant (no _id) -> push
          if (!v._id) {
            // Ensure SKU uniqueness or generate one
            let finalSku = v.sku;
            if (finalSku) {
              const existing = await Product.findOne({ 'variants.sku': finalSku });
              if (existing) {
                return res.status(400).json({ success: false, message: `SKU ${finalSku} already exists` });
              }
            } else {
              finalSku = await generateUniqueSku();
            }

            const newVariant = {
              color: v.color,
              price: v.price !== undefined ? parseFloat(v.price) : 0,
              stock: v.stock !== undefined ? parseInt(v.stock) : 0,
              sku: finalSku,
              images: v.images || [],
              isActive: v.isActive !== undefined ? v.isActive : true
            };
            product.variants.push(newVariant);
          } else {
            // Update existing variant
            const variant = product.variants.id(v._id);
            if (!variant) {
              return res.status(404).json({ success: false, message: `Variant ${v._id} not found` });
            }

            // If sku provided and changed, ensure global uniqueness
            if (v.sku && v.sku !== variant.sku) {
              const existing = await Product.findOne({ 'variants.sku': v.sku });
              if (existing) {
                // If the existing product is not this product, or the sku belongs to a different variant, block
                const belongsToThisProduct = existing._id.toString() === product._id.toString();
                const sameVariantExists = belongsToThisProduct && existing.variants.some(ev => ev.sku === v.sku && ev._id.toString() === v._id);
                if (!sameVariantExists) {
                  return res.status(400).json({ success: false, message: `SKU ${v.sku} already exists` });
                }
              }
            }

            if (v.color) variant.color = v.color;
            if (v.price !== undefined) variant.price = parseFloat(v.price);
            if (v.stock !== undefined) variant.stock = parseInt(v.stock);
            if (v.sku) variant.sku = v.sku;
            if (v.images) variant.images = v.images;
            if (v.isActive !== undefined) variant.isActive = v.isActive;
          }
        }
      }

      await product.save();
      clearCache();

      logger.info('Product updated:', { productId: product._id, title: product.title });

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: { product }
      });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product (Admin only)
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete images from Cloudinary
    if (product.mockupTemplatePublicId) {
      await deleteImage(product.mockupTemplatePublicId);
    }

    for (const variant of product.variants) {
      for (const image of variant.images) {
        if (image.publicId) {
          await deleteImage(image.publicId);
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    clearCache();

    logger.info('Product deleted:', { productId: product._id, title: product.title });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add variant to product (Admin only)
 * POST /api/products/:id/variants
 */
const addVariant = async (req, res, next) => {
  try {
    const { color, price, stock, sku } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // If sku provided, ensure uniqueness; otherwise generate one
    let finalSku = sku;
    if (finalSku) {
      const existingProduct = await Product.findOne({ 'variants.sku': finalSku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    } else {
      finalSku = await generateUniqueSku();
    }

    // Create new variant
    const newVariant = {
      color,
      price: parseFloat(price),
      stock: parseInt(stock),
      sku: finalSku,
      images: []
    };

    product.variants.push(newVariant);
    await product.save();
    clearCache();

    logger.info('Variant added:', { productId: product._id, sku: finalSku });

    res.status(201).json({
      success: true,
      message: 'Variant added successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update variant (Admin only)
 * PUT /api/products/:id/variants/:variantId
 */
const updateVariant = async (req, res, next) => {
  try {
    const { color, price, stock, sku, isActive } = req.body;

    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const variant = product.variants.id(req.params.variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }

    // Check if SKU is unique (excluding current variant). If sku provided, validate uniqueness.
    if (sku && sku !== variant.sku) {
      const existingVariant = product.variants.find(v => v.sku === sku && v._id.toString() !== req.params.variantId);
      if (existingVariant) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    }

    // Update variant
    if (color) variant.color = color;
    if (price) variant.price = parseFloat(price);
    if (stock !== undefined) variant.stock = parseInt(stock);
    if (sku) variant.sku = sku;
    if (isActive !== undefined) variant.isActive = isActive;

    await product.save();
    clearCache();

    logger.info('Variant updated:', { productId: product._id, variantId: req.params.variantId });

    res.json({
      success: true,
      message: 'Variant updated successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete variant (Admin only)
 * DELETE /api/products/:id/variants/:variantId
 */
const deleteVariant = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const variant = product.variants.id(req.params.variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }

    // Delete variant images from Cloudinary
    for (const image of variant.images) {
      if (image.publicId) {
        await deleteImage(image.publicId);
      }
    }

    // Remove variant in a safe way (avoid subdocument.remove() in certain Mongoose versions)
    product.variants = product.variants.filter(v => v._id.toString() !== req.params.variantId);
    await product.save();
    clearCache();

    logger.info('Variant deleted:', { productId: product._id, variantId: req.params.variantId });

    res.json({
      success: true,
      message: 'Variant deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant
};