const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductReview = require('../models/ProductReview');
const logger = require('../utils/logger');

const EMPTY_BREAKDOWN = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const MAX_PAGE_SIZE = 30;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const canEditReview = (review, user) => {
  if (!user) return false;
  if (String(review.user) === String(user._id)) return true;
  return user.role === 'admin';
};

const aggregateRatingData = async (productId) => {
  const matchStage = {
    product: new mongoose.Types.ObjectId(productId),
    status: 'published'
  };

  const [result] = await ProductReview.aggregate([
    { $match: matchStage },
    {
      $facet: {
        ratingStats: [
          {
            $group: {
              _id: null,
              average: { $avg: '$rating' },
              count: { $sum: 1 }
            }
          }
        ],
        breakdown: [
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  const ratingStats = result?.ratingStats?.[0];
  const breakdown = { ...EMPTY_BREAKDOWN };

  (result?.breakdown || []).forEach(({ _id, count }) => {
    if (_id >= 1 && _id <= 5) {
      breakdown[_id] = count;
    }
  });

  const rating = {
    average: ratingStats?.average ? Number(ratingStats.average.toFixed(1)) : 0,
    count: ratingStats?.count || 0
  };

  return { rating, breakdown };
};

const recalcProductRating = async (productId) => {
  const snapshot = await aggregateRatingData(productId);
  await Product.findByIdAndUpdate(productId, { rating: snapshot.rating }).catch(() => {});
  return snapshot;
};

const serializeReview = (reviewDoc, viewerId) => {
  if (!reviewDoc) return null;
  const review = reviewDoc.toObject({ versionKey: false });
  if (review.user && typeof review.user === 'object') {
    review.user = {
      _id: review.user._id,
      name: review.user.name
    };
  }
  review.canEdit = viewerId ? String(review.user?._id || review.user) === String(viewerId) : false;
  return review;
};

const ensureProductExists = async (productId) => {
  const product = await Product.findById(productId).select('_id isActive');
  if (!product || !product.isActive) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }
};

const getProductReviews = async (req, res, next) => {
  try {
    const productId = req.params.id;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    await ensureProductExists(productId);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;
    const viewerId = req.user?._id?.toString();

    const baseQuery = { product: productId, status: 'published' };

    const [reviewsDocs, totalCount, snapshot, viewerReviewDoc] = await Promise.all([
      ProductReview.find(baseQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name'),
      ProductReview.countDocuments(baseQuery),
      aggregateRatingData(productId),
      viewerId
        ? ProductReview.findOne({ product: productId, user: viewerId }).populate('user', 'name')
        : Promise.resolve(null)
    ]);

    const reviews = reviewsDocs.map((doc) => serializeReview(doc, viewerId));
    const viewerReview = serializeReview(viewerReviewDoc, viewerId);

    res.json({
      success: true,
      data: {
        items: reviews,
        rating: snapshot.rating,
        breakdown: snapshot.breakdown,
        pagination: {
          page,
          limit,
          totalPages: totalCount ? Math.ceil(totalCount / limit) : 1,
          totalItems: totalCount
        },
        viewerReview
      }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const createProductReview = async (req, res, next) => {
  try {
    const productId = req.params.id;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    await ensureProductExists(productId);

    const viewerId = req.user._id;
    const { rating, title, comment } = req.body;

    const existing = await ProductReview.findOne({ product: productId, user: viewerId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product.' });
    }

    const review = new ProductReview({
      product: productId,
      user: viewerId,
      rating,
      title: title?.trim() || undefined,
      comment: comment?.trim() || undefined
    });

    await review.save();
    await review.populate('user', 'name');

    const snapshot = await recalcProductRating(productId);
    const serialized = serializeReview(review, viewerId);

    logger.info('Product review created', { productId, reviewId: review._id, userId: viewerId });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review: serialized,
        rating: snapshot.rating,
        breakdown: snapshot.breakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateProductReview = async (req, res, next) => {
  try {
    const { id: productId, reviewId } = req.params;
    if (!isValidObjectId(productId) || !isValidObjectId(reviewId)) {
      return res.status(400).json({ success: false, message: 'Invalid identifier' });
    }

    await ensureProductExists(productId);

    const review = await ProductReview.findOne({ _id: reviewId, product: productId });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (!canEditReview(review, req.user)) {
      return res.status(403).json({ success: false, message: 'You cannot edit this review' });
    }

    const { rating, title, comment } = req.body;
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title?.trim() || undefined;
    if (comment !== undefined) review.comment = comment?.trim() || undefined;

    await review.save();
    await review.populate('user', 'name');

    const snapshot = await recalcProductRating(productId);
    const serialized = serializeReview(review, req.user._id);

    logger.info('Product review updated', { productId, reviewId: review._id, userId: req.user._id });

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review: serialized,
        rating: snapshot.rating,
        breakdown: snapshot.breakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteProductReview = async (req, res, next) => {
  try {
    const { id: productId, reviewId } = req.params;
    if (!isValidObjectId(productId) || !isValidObjectId(reviewId)) {
      return res.status(400).json({ success: false, message: 'Invalid identifier' });
    }

    await ensureProductExists(productId);

    const review = await ProductReview.findOne({ _id: reviewId, product: productId });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (!canEditReview(review, req.user)) {
      return res.status(403).json({ success: false, message: 'You cannot delete this review' });
    }

    await review.deleteOne();

    const snapshot = await recalcProductRating(productId);

    logger.info('Product review deleted', { productId, reviewId, userId: req.user._id });

    res.json({
      success: true,
      message: 'Review deleted successfully',
      data: {
        reviewId,
        rating: snapshot.rating,
        breakdown: snapshot.breakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProductReviews,
  createProductReview,
  updateProductReview,
  deleteProductReview
};
