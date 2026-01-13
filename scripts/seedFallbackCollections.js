require('dotenv').config();
const mongoose = require('mongoose');
const Collection = require('../models/Collection');


const slugify = (value = '') =>
  value.toString().trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const RAW_FALLBACK_COLLECTIONS = [
  {
    handle: 'dreamy-pastels',
    title: 'Dreamy Pastels',
    tagline: 'Soft gradients with a glassy sheen.',
    accentColor: '#f472b6',
    heroImage: 'https://res.cloudinary.com/xxxx/ONE.png',
    description: 'A soothing drop featuring hazy gradients.',
    images: [
      { url: 'https://res.cloudinary.com/xxxx/ONE.png', caption: 'Sunset fizz' },
      { url: 'https://res.cloudinary.com/xxxx/FOUR.png', caption: 'Petal glass' }
    ]
  },
  {
    handle: 'fallback-marble-theme',
    title: 'Fallback Marble Theme',
    tagline: 'Elegant marble patterns for timeless appeal.',
    accentColor: '#6b7280',
    heroImage: 'https://res.cloudinary.com/xxxx/MARBLE_HERO.png',
    description: 'Classic marble designs that never go out of style.',
    images: [
      { url: 'https://res.cloudinary.com/xxxx/MARBLE1.png', caption: 'White marble' },
      { url: 'https://res.cloudinary.com/xxxx/MARBLE2.png', caption: 'Gray marble' }
    ]
  },
  {
    handle: 'fallback-krishna-theme',
    title: 'Fallback Krishna Theme',
    tagline: 'Spiritual designs inspired by Krishna.',
    accentColor: '#1e40af',
    heroImage: 'https://res.cloudinary.com/xxxx/KRISHNA_HERO.png',
    description: 'Beautiful Krishna-themed designs for mobile covers.',
    images: [
      { url: 'https://res.cloudinary.com/xxxx/KRISHNA1.png', caption: 'Krishna with flute' },
      { url: 'https://res.cloudinary.com/xxxx/KRISHNA2.png', caption: 'Krishna art' }
    ]
  },
  // other collections…
];

const FALLBACK_COLLECTIONS = RAW_FALLBACK_COLLECTIONS.map((c, i) => {
  const handle = slugify(c.handle || c.title || `fallback-${i}`);
  return {
    ...c,
    handle,
    images: c.images.map((img, index) => ({
      url: img.url,
      caption: img.caption,
      sortOrder: index
    }))
  };
});

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-cover-ecommerce';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    for (const item of FALLBACK_COLLECTIONS) {
      const exists = await Collection.findOne({ handle: item.handle });
      if (exists) {
        console.log(`Skipped: ${item.handle}`);
        continue;
      }

      await Collection.create({
        title: item.title,
        handle: item.handle,
        description: item.description,
        tagline: item.tagline,
        accentColor: item.accentColor,
        heroImage: { url: item.heroImage },
        images: item.images,
        isActive: true
      });

      console.log(`Inserted: ${item.handle}`);
    }

    console.log('Seeding done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
