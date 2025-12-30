const mongoose = require('mongoose');
const slugify = require('slugify');

const mobileModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileCompany', required: true },
  description: { type: String, default: '' },
  images: [{ url: String, publicId: String }],
  specs: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

mobileModelSchema.index({ company: 1, slug: 1 }, { unique: true });

mobileModelSchema.pre('validate', function(next) {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('MobileModel', mobileModelSchema);
