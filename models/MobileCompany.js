const mongoose = require('mongoose');
const slugify = require('slugify');

const mobileCompanySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  logo: {
    url: { type: String },
    publicId: { type: String }
  }
}, { timestamps: true });

mobileCompanySchema.pre('validate', function(next) {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('MobileCompany', mobileCompanySchema);
