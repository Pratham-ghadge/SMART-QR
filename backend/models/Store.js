const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  imageUrl: { type: String },
  category: { type: String, default: 'General Store' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  operatingHours: {
    mon_fri: { type: String, default: '9 AM – 10 PM' },
    sat_sun: { type: String, default: '10 AM – 11 PM' }
  },
  isOpen: { type: Boolean, default: true },
  disableOrders: { type: Boolean, default: false },
  qrCode: { type: String }, // Store entry QR
  createdAt: { type: Date, default: Date.now }
});

storeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Store', storeSchema);