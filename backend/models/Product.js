const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  qrCode: { type: String, required: true },
  imageUrl: { type: String },
  category: { type: String },
  stock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);