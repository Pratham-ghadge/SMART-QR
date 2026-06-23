const express = require('express');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const qrcode = require('qrcode');

const router = express.Router();

// Middleware to verify store token
const verifyStore = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.storeId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Add Product
router.post('/', verifyStore, async (req, res) => {
  const { name, description, price, category, stock, imageUrl } = req.body;
  try {
    const product = new Product({ storeId: req.storeId, name, description, price, category, stock, imageUrl });
    const qr = await qrcode.toDataURL(`product-${product._id}`);
    product.qrCode = qr;
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Products by Store
router.get('/', verifyStore, async (req, res) => {
  try {
    const products = await Product.find({ storeId: req.storeId });
    res.json(products);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Product
router.put('/:id', verifyStore, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, storeId: req.storeId },
      req.body,
      { new: true }
    );
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Product
router.delete('/:id', verifyStore, async (req, res) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, storeId: req.storeId });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Product by ID (for customer QR scanning)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'Invalid product ID' });
  }
});

// Get Product by QR
router.get('/scan/:qr', async (req, res) => {
  try {
    const product = await Product.findOne({ qrCode: req.params.qr });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;