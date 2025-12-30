const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  key: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 2,
    maxlength: 80,
    unique: true,
  },
  category: {
    type: String,
    trim: true,
    default: 'General',
    maxlength: 120,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ThemeCategory',
    default: null,
  },
  basePrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  mobileCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MobileCompany',
    default: null,
  },
  mobileModelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MobileModel',
    default: null,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  variables: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  assets: {
    posterUrl: { type: String, trim: true },
    posterPublicId: { type: String, trim: true },
  },
  active: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Theme', ThemeSchema);
