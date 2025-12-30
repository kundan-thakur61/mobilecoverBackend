const path = require('path');
const fs = require('fs/promises');
const MobileCompany = require('../models/MobileCompany');
const MobileModel = require('../models/MobileModel');
const Theme = require('../models/Theme');
const ThemeCategory = require('../models/ThemeCategory');
const logger = require('../utils/logger');
const uploadsDir = path.join(__dirname, '../public/uploads');

const cleanUrl = (u) => {
  if (!u) return '';
  if (typeof u !== 'string') return '';
  const v = u.trim();
  if (!v) return '';
  if (v === '/uploads/undefined' || v.endsWith('/undefined') || v.includes('/uploads/undefined')) return '';
  return v;
};

const sanitizeModelForClient = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : JSON.parse(JSON.stringify(doc));
  if (Array.isArray(obj.images)) {
    obj.images = obj.images.map((img) => ({ ...img, url: cleanUrl(img?.url) }));
  } else obj.images = [];
  return obj;
};

const DEFAULT_THEME_CATEGORY = 'General';

const slugify = (value = '') => (
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 160)
);

const sanitizeThemeVariables = (input) => {
  if (!input || typeof input !== 'object') return {};
  return Object.entries(input).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = typeof value === 'string' ? value.trim() : value;
    return acc;
  }, {});
};

const normalizeThemeAssets = (input = {}) => {
  if (!input || typeof input !== 'object') return undefined;
  const posterUrl = input.posterUrl || input.url || input.secure_url;
  const posterPublicId = input.posterPublicId || input.publicId || input.public_id;
  if (!posterUrl && !posterPublicId) return undefined;
  return {
    posterUrl: posterUrl || '',
    posterPublicId: posterPublicId || '',
  };
};

const coerceCategory = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_THEME_CATEGORY
);

const resolveThemeCategoryBinding = async ({ categoryId, fallbackCategory }) => {
  if (categoryId) {
    const categoryDocument = await ThemeCategory.findById(categoryId);
    if (!categoryDocument) {
      const error = new Error('Theme category not found');
      error.statusCode = 404;
      throw error;
    }
    return {
      categoryId: categoryDocument._id,
      categoryLabel: categoryDocument.name,
    };
  }

  return {
    categoryId: null,
    categoryLabel: coerceCategory(fallbackCategory),
  };
};

const resolveMobileBindings = async ({ mobileCompanyId, mobileModelId }) => {
  const bindings = { mobileCompanyId: null, mobileModelId: null };
  let companyDoc = null;

  if (mobileCompanyId) {
    companyDoc = await MobileCompany.findById(mobileCompanyId);
    if (!companyDoc) {
      const error = new Error('Mobile company not found');
      error.statusCode = 404;
      throw error;
    }
    bindings.mobileCompanyId = companyDoc._id;
  }

  if (mobileModelId) {
    const modelDoc = await MobileModel.findById(mobileModelId).populate('company', 'name slug');
    if (!modelDoc) {
      const error = new Error('Mobile model not found');
      error.statusCode = 404;
      throw error;
    }
    bindings.mobileModelId = modelDoc._id;

    if (!bindings.mobileCompanyId && modelDoc.company?._id) {
      bindings.mobileCompanyId = modelDoc.company._id;
    } else if (bindings.mobileCompanyId && modelDoc.company?._id && bindings.mobileCompanyId.toString() !== modelDoc.company._id.toString()) {
      const error = new Error('Model does not belong to selected company');
      error.statusCode = 400;
      throw error;
    }
  }

  return bindings;
};

// MOBILE COMPANIES
const listCompanies = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const q = {};
    if (search) q.name = new RegExp(search.trim(), 'i');

    const [items, total] = await Promise.all([
      MobileCompany.find(q).sort({ name: 1 }).skip((page-1)*limit).limit(parseInt(limit, 10)),
      MobileCompany.countDocuments(q)
    ]);

    res.json({ success: true, data: { companies: items, pagination: { page: parseInt(page,10), totalPages: Math.ceil(total/limit), total } } });
  } catch (err) {
    logger.error('listCompanies', err);
    next(err);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const { name, description, logo } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Company name is required' });
    const company = new MobileCompany({ name: name.trim(), description: description || '', logo: logo || {} });
    await company.save();
    res.status(201).json({ success: true, data: company });
  } catch (err) {
    logger.error('createCompany', err);
    next(err);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = {};
    ['name','description','logo'].forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });
    const updated = await MobileCompany.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('updateCompany', err);
    next(err);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    // cascade: delete models belonging to this company
    await MobileModel.deleteMany({ company: id });
    const r = await MobileCompany.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: r });
  } catch (err) {
    logger.error('deleteCompany', err);
    next(err);
  }
};

// MOBILE MODELS
const listModels = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, company, search } = req.query;
    const q = {};
    if (company) q.company = company;
    if (search) q.name = new RegExp(search.trim(), 'i');

    const [items, total] = await Promise.all([
      MobileModel.find(q).populate('company', 'name slug').sort({ name: 1 }).skip((page-1)*limit).limit(parseInt(limit, 10)),
      MobileModel.countDocuments(q)
    ]);

    res.json({ success: true, data: { models: items, pagination: { page: parseInt(page,10), totalPages: Math.ceil(total/limit), total } } });
  } catch (err) {
    logger.error('listModels', err);
    next(err);
  }
};

const createModel = async (req, res, next) => {
  try {
    const { name, company, description, images, specs } = req.body;
    if (!name || !company) return res.status(400).json({ success: false, message: 'name and company are required' });
    const m = new MobileModel({ name: name.trim(), company, description: description || '', images: images || [], specs: specs || {} });
    await m.save();
    const populated = await m.populate('company', 'name slug');
    res.status(201).json({ success: true, data: sanitizeModelForClient(populated) });
  } catch (err) {
    logger.error('createModel', err);
    next(err);
  }
};

const updateModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = {};
    ['name','company','description','images','specs'].forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });
    const updated = await MobileModel.findByIdAndUpdate(id, payload, { new: true }).populate('company', 'name slug');
    if (!updated) return res.status(404).json({ success: false, message: 'Model not found' });
    res.json({ success: true, data: sanitizeModelForClient(updated) });
  } catch (err) {
    logger.error('updateModel', err);
    next(err);
  }
};

const { uploadFromBuffer } = require('../utils/cloudinary');

const deleteModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await MobileModel.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ success: false, message: 'Model not found' });
    res.json({ success: true, data: sanitizeModelForClient(r) });
  } catch (err) {
    logger.error('deleteModel', err);
    next(err);
  }
};

const addModelFrames = async (req, res, next) => {
  try {
    const { id } = req.params;
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'At least one frame image is required' });
    }

    const payload = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file || !file.buffer) {
        throw new Error('Invalid file upload payload');
      }
      const result = await uploadFromBuffer(file.buffer, { folder: 'frames' });
      payload.push({ url: result.secure_url || '', publicId: result.public_id || '' });
    }

    const updated = await MobileModel.findByIdAndUpdate(
      id,
      { $push: { images: { $each: payload } } },
      { new: true }
    ).populate('company', 'name slug');

    if (!updated) {
      await Promise.all(files.map((file) => fs.unlink(path.join(uploadsDir, file.filename)).catch(() => {})));
      return res.status(404).json({ success: false, message: 'Model not found' });
    }

    res.status(201).json({ success: true, data: sanitizeModelForClient(updated) });
  } catch (err) {
    logger.error('addModelFrames', err);
    next(err);
  }
};

const removeModelFrame = async (req, res, next) => {
  try {
    const { id, frameId } = req.params;
    const model = await MobileModel.findById(id).populate('company', 'name slug');
    if (!model) {
      return res.status(404).json({ success: false, message: 'Model not found' });
    }

    if (!Array.isArray(model.images)) {
      model.images = [];
    }

    const frame = model.images.id(frameId) || model.images.find((img) => img && img._id && img._id.toString() === frameId);
    if (!frame) {
      return res.status(404).json({ success: false, message: 'Frame not found' });
    }

    const publicId = frame.publicId;
    model.images = model.images.filter((img) => !(img && img._id && img._id.toString() === frameId));
    await model.save();

    if (publicId) {
      const filePath = path.join(uploadsDir, publicId);
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        logger.warn('removeModelFrame: failed to delete file', { filePath, error: unlinkErr.message });
      }
    }

    res.json({ success: true, data: sanitizeModelForClient(model) });
  } catch (err) {
    logger.error('removeModelFrame', err);
    next(err);
  }
};

// THEME CATEGORIES
const listThemeCategories = async (req, res, next) => {
  try {
    const categories = await ThemeCategory.find({}).sort({ sortOrder: 1, name: 1 });
    const counts = await Theme.aggregate([
      { $group: { _id: '$categoryId', total: { $sum: 1 } } }
    ]);

    const countMap = counts.reduce((acc, entry) => {
      const key = entry._id ? entry._id.toString() : '__uncategorized';
      acc[key] = entry.total;
      return acc;
    }, {});

    const payload = categories.map((categoryDoc) => {
      const obj = categoryDoc.toObject();
      const key = categoryDoc._id.toString();
      obj.stats = { totalThemes: countMap[key] || 0 };
      return obj;
    });

    res.json({
      success: true,
      data: {
        categories: payload,
        uncategorized: countMap.__uncategorized || 0,
      },
    });
  } catch (err) {
    logger.error('listThemeCategories', err);
    next(err);
  }
};

const createThemeCategory = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const normalizedSlug = slugify(slug || name);
    if (!normalizedSlug) {
      return res.status(400).json({ success: false, message: 'A valid slug is required' });
    }

    const existing = await ThemeCategory.findOne({ slug: normalizedSlug });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }

    const category = new ThemeCategory({
      name: name.trim(),
      slug: normalizedSlug,
      description: typeof description === 'string' ? description.trim() : description,
      accentColor: typeof req.body.accentColor === 'string' ? req.body.accentColor.trim() : req.body.accentColor,
      textColor: typeof req.body.textColor === 'string' ? req.body.textColor.trim() : req.body.textColor,
      coverImage: typeof req.body.coverImage === 'string' ? req.body.coverImage.trim() : req.body.coverImage,
      sortOrder: Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0,
      isFeatured: !!req.body.isFeatured,
      active: req.body.active === undefined ? true : !!req.body.active,
    });

    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    logger.error('createThemeCategory', err);
    next(err);
  }
};

const updateThemeCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = {};

    if (req.body.name !== undefined) payload.name = typeof req.body.name === 'string' ? req.body.name.trim() : req.body.name;
    if (req.body.description !== undefined) payload.description = typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description;
    if (req.body.accentColor !== undefined) payload.accentColor = typeof req.body.accentColor === 'string' ? req.body.accentColor.trim() : req.body.accentColor;
    if (req.body.textColor !== undefined) payload.textColor = typeof req.body.textColor === 'string' ? req.body.textColor.trim() : req.body.textColor;
    if (req.body.coverImage !== undefined) payload.coverImage = typeof req.body.coverImage === 'string' ? req.body.coverImage.trim() : req.body.coverImage;
    if (req.body.sortOrder !== undefined) payload.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.isFeatured !== undefined) payload.isFeatured = !!req.body.isFeatured;
    if (req.body.active !== undefined) payload.active = !!req.body.active;

    if (req.body.slug !== undefined || payload.name) {
      const normalizedSlug = slugify(req.body.slug || payload.name || '');
      if (!normalizedSlug) {
        return res.status(400).json({ success: false, message: 'A valid slug is required' });
      }
      const existing = await ThemeCategory.findOne({ slug: normalizedSlug, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Slug already exists' });
      }
      payload.slug = normalizedSlug;
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, message: 'No category fields provided for update' });
    }

    const updated = await ThemeCategory.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('updateThemeCategory', err);
    next(err);
  }
};

const deleteThemeCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inUse = await Theme.exists({ categoryId: id });
    if (inUse) {
      return res.status(409).json({ success: false, message: 'Delete or reassign themes before removing this category' });
    }

    const deleted = await ThemeCategory.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, data: deleted });
  } catch (err) {
    logger.error('deleteThemeCategory', err);
    next(err);
  }
};

// THEMES
const listThemes = async (req, res, next) => {
  try {
    const { categoryId, search } = req.query;
    const query = {};
    if (categoryId && categoryId !== 'all') {
      query.categoryId = categoryId;
    }
    if (search && search.trim()) {
      query.name = new RegExp(search.trim(), 'i');
    }

    const items = await Theme.find(query)
      .populate('categoryId')
      .populate('mobileCompanyId', 'name slug')
      .populate({ path: 'mobileModelId', select: 'name company images', populate: { path: 'company', select: 'name slug' } })
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: { themes: items } });
  } catch (err) {
    logger.error('listThemes', err);
    next(err);
  }
};

const createTheme = async (req, res, next) => {
  try {
    const { name, key, variables } = req.body;
    if (!name || !name.trim() || !key || !key.trim()) {
      return res.status(400).json({ success: false, message: 'name and key are required' });
    }

    const { categoryId: resolvedCategoryId, categoryLabel } = await resolveThemeCategoryBinding({
      categoryId: req.body.categoryId,
      fallbackCategory: req.body.category,
    });

    const themePayload = {
      name: name.trim(),
      key: key.trim(),
      category: categoryLabel,
      description: typeof req.body.description === 'string' ? req.body.description.trim() : undefined,
      variables: sanitizeThemeVariables(variables),
      active: !!req.body.active,
    };

    const priceValue = Number(req.body.basePrice ?? req.body.price);
    if (Number.isFinite(priceValue) && priceValue >= 0) {
      themePayload.basePrice = priceValue;
    }

    const { mobileCompanyId, mobileModelId } = await resolveMobileBindings({
      mobileCompanyId: req.body.mobileCompanyId || req.body.companyId,
      mobileModelId: req.body.mobileModelId || req.body.modelId,
    });

    if (mobileCompanyId) themePayload.mobileCompanyId = mobileCompanyId;
    if (mobileModelId) themePayload.mobileModelId = mobileModelId;

    if (resolvedCategoryId) {
      themePayload.categoryId = resolvedCategoryId;
    }

    const assets = normalizeThemeAssets(req.body.assets || req.body.poster);
    if (assets) themePayload.assets = assets;

    const t = new Theme(themePayload);
    await t.save();
    res.status(201).json({ success: true, data: t });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    logger.error('createTheme', err);
    next(err);
  }
};

const updateTheme = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = {};

    if (req.body.name !== undefined) payload.name = typeof req.body.name === 'string' ? req.body.name.trim() : req.body.name;
    if (req.body.key !== undefined) payload.key = typeof req.body.key === 'string' ? req.body.key.trim() : req.body.key;
    if (req.body.description !== undefined) payload.description = typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description;
    if (req.body.variables !== undefined) payload.variables = sanitizeThemeVariables(req.body.variables);
    if (req.body.active !== undefined) payload.active = !!req.body.active;

    if (req.body.basePrice !== undefined || req.body.price !== undefined) {
      const priceValue = Number(req.body.basePrice ?? req.body.price);
      if (Number.isFinite(priceValue) && priceValue >= 0) {
        payload.basePrice = priceValue;
      }
    }

    if (req.body.categoryId !== undefined || req.body.category !== undefined) {
      const { categoryId: resolvedCategoryId, categoryLabel } = await resolveThemeCategoryBinding({
        categoryId: req.body.categoryId,
        fallbackCategory: req.body.category,
      });
      payload.category = categoryLabel;
      payload.categoryId = resolvedCategoryId;
    }

    if (req.body.mobileCompanyId !== undefined || req.body.mobileModelId !== undefined || req.body.companyId !== undefined || req.body.modelId !== undefined) {
      const { mobileCompanyId, mobileModelId } = await resolveMobileBindings({
        mobileCompanyId: req.body.mobileCompanyId ?? req.body.companyId,
        mobileModelId: req.body.mobileModelId ?? req.body.modelId,
      });
      payload.mobileCompanyId = mobileCompanyId;
      payload.mobileModelId = mobileModelId;
    }

    const assets = normalizeThemeAssets(req.body.assets || req.body.poster);
    if (assets) payload.assets = assets;

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, message: 'No theme fields provided for update' });
    }

    const updated = await Theme.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Theme not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    logger.error('updateTheme', err);
    next(err);
  }
};

const deleteTheme = async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await Theme.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ success: false, message: 'Theme not found' });
    res.json({ success: true, data: r });
  } catch (err) {
    logger.error('deleteTheme', err);
    next(err);
  }
};

const activateTheme = async (req, res, next) => {
  try {
    const { id } = req.params;
    // set all to false, then set this to true
    await Theme.updateMany({}, { $set: { active: false } });
    const updated = await Theme.findByIdAndUpdate(id, { active: true }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Theme not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('activateTheme', err);
    next(err);
  }
};

const getActiveTheme = async (req, res, next) => {
  try {
    const t = await Theme.findOne({ active: true })
      .populate('categoryId')
      .populate('mobileCompanyId', 'name slug')
      .populate({ path: 'mobileModelId', select: 'name company images', populate: { path: 'company', select: 'name slug' } });
    res.json({ success: true, data: { theme: t || null } });
  } catch (err) {
    logger.error('getActiveTheme', err);
    next(err);
  }
};

const getThemeByKey = async (req, res, next) => {
  try {
    const rawKey = req.params.key || req.params.slug || '';
    const normalizedKey = rawKey.trim().toLowerCase();
    if (!normalizedKey) {
      return res.status(400).json({ success: false, message: 'Theme key is required' });
    }

    const theme = await Theme.findOne({ key: normalizedKey })
      .populate('categoryId')
      .populate('mobileCompanyId', 'name slug')
      .populate({ path: 'mobileModelId', select: 'name company images', populate: { path: 'company', select: 'name slug' } });

    if (!theme) {
      return res.status(404).json({ success: false, message: 'Theme not found' });
    }

    res.json({ success: true, data: { theme } });
  } catch (err) {
    logger.error('getThemeByKey', err);
    next(err);
  }
};

module.exports = {
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  listModels,
  createModel,
  updateModel,
  deleteModel,
  addModelFrames,
  removeModelFrame,
  listThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  activateTheme,
  getActiveTheme,
  getThemeByKey,
  listThemeCategories,
  createThemeCategory,
  updateThemeCategory,
  deleteThemeCategory,
};
