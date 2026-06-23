const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Store = require('../models/Store');
const Customer = require('../models/Customer');
const qrcode = require('qrcode');

const router = express.Router();

// Register Store
router.post('/register', async (req, res) => {
  const { name, email, password, address, phone } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const store = new Store({ name, email, password: hashedPassword, address, phone });
    await store.save(); // Save first to get the _id
    const qr = await qrcode.toDataURL(`store-${store._id}`);
    store.qrCode = qr;
    await store.save(); // Save again with the QR code
    res.status(201).json({ message: 'Store registered', qrCode: qr });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login Store
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const store = await Store.findOne({ email });
    if (!store || !(await bcrypt.compare(password, store.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: store._id }, process.env.JWT_SECRET);
    res.json({ token, store });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get store profile (must come before /:storeId)
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const store = await Store.findById(decoded.id).select('-password');
    
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    res.json(store);
  } catch (err) {
    console.error('Profile error:', err.message);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(401).json({ error: err.message || 'Unauthorized' });
  }
});

// Get store by ID (for QR scanning)
router.get('/:storeId', async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId).select('-password');
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json(store);
  } catch (err) {
    res.status(400).json({ error: 'Invalid store ID' });
  }
});

// Add this route block so that shopkeeper can update their location and image
router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
    
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.address) updateData.address = req.body.address;
    if (req.body.phone) updateData.phone = req.body.phone;
    if (req.body.imageUrl) updateData.imageUrl = req.body.imageUrl;
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.isOpen !== undefined) updateData.isOpen = req.body.isOpen;
    if (req.body.disableOrders !== undefined) updateData.disableOrders = req.body.disableOrders;
    
    if (req.body.operatingHours) {
      updateData.operatingHours = req.body.operatingHours;
    }
    
    // Accept [longitude, latitude] array
    if (req.body.coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates: req.body.coordinates
      };
    }
    
    const store = await Store.findByIdAndUpdate(decoded.id, updateData, { new: true }).select('-password');
    if (!store) return res.status(404).json({ error: 'Store not found' });
    
    res.json(store);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET statistics for dashboard
router.get('/stats/:storeId', async (req, res) => {
  try {
    const Order = require('../models/Order');
    const storeId = req.params.storeId;
    
    const now = new Date();
    const todayStart = new Date(now.setHours(0,0,0,0));
    const yesterdayStart = new Date(new Date(todayStart).setDate(todayStart.getDate() - 1));
    const weekStart = new Date(new Date(todayStart).setDate(todayStart.getDate() - 7));
    const monthStart = new Date(new Date(todayStart).setMonth(todayStart.getMonth() - 1));

    // 1. Current Visitors (People inside store - no exitTime)
    const activeVisitors = await Order.countDocuments({ storeId, exitTime: null });

    // 2. Sales aggregation (Paid only)
    const salesData = await Order.aggregate([
      { $match: { storeId: new mongoose.Types.ObjectId(storeId), paymentStatus: 'paid' } },
      { $group: {
          _id: null,
          totalAllTime: { $sum: "$totalAmount" },
          today: { $sum: { $cond: [{ $gte: ["$createdAt", todayStart] }, "$totalAmount", 0] } },
          yesterday: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", yesterdayStart] }, { $lt: ["$createdAt", todayStart] }] }, "$totalAmount", 0] } },
          last7Days: { $sum: { $cond: [{ $gte: ["$createdAt", weekStart] }, "$totalAmount", 0] } }
        }
      }
    ]);

    // 3. Graph Data (Last 7 days daily sales)
    const dailyGraph = await Order.aggregate([
      { $match: { 
          storeId: new mongoose.Types.ObjectId(storeId), 
          paymentStatus: 'paid',
          createdAt: { $gte: weekStart }
      }},
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          amount: { $sum: "$totalAmount" }
      }},
      { $sort: { "_id": 1 } }
    ]);

    res.json({
      activeVisitors,
      sales: salesData[0] || { totalAllTime: 0, today: 0, yesterday: 0, last7Days: 0 },
      dailyGraph
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Full Analytics for Analytics page ─────────────────────────────────────────
router.get('/analytics/:storeId', async (req, res) => {
  try {
    const Order   = require('../models/Order');
    const Product = require('../models/Product');
    const { storeId } = req.params;
    const oid = new mongoose.Types.ObjectId(storeId);

    const now  = new Date();
    const tod  = new Date(now); tod.setHours(0,0,0,0);
    const yest = new Date(tod); yest.setDate(yest.getDate() - 1);
    const w7   = new Date(tod); w7.setDate(w7.getDate() - 7);
    const w30  = new Date(tod); w30.setDate(w30.getDate() - 30);
    const w365 = new Date(tod); w365.setFullYear(w365.getFullYear() - 1);
    const w84  = new Date(tod); w84.setDate(w84.getDate() - 84);

    // 1. Revenue & order totals
    const totals = await Order.aggregate([
      { $match: { storeId: oid, paymentStatus: 'paid' } },
      { $group: {
        _id: null,
        totalRevenue:  { $sum: '$totalAmount' },
        totalOrders:   { $sum: 1 },
        today:         { $sum: { $cond: [{ $gte: ['$createdAt', tod] }, '$totalAmount', 0] } },
        todayOrders:   { $sum: { $cond: [{ $gte: ['$createdAt', tod] }, 1, 0] } },
        yesterday:     { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', yest] }, { $lt: ['$createdAt', tod] }] }, '$totalAmount', 0] } },
        last7Days:     { $sum: { $cond: [{ $gte: ['$createdAt', w7] }, '$totalAmount', 0] } },
        last30Days:    { $sum: { $cond: [{ $gte: ['$createdAt', w30] }, '$totalAmount', 0] } },
      }}
    ]);
    const t = totals[0] || {};

    // 2. Active visitors
    const activeVisitors = await Order.countDocuments({ storeId, exitTime: null });

    // 3. Unique customers
    const uniqueCustomers       = (await Order.distinct('customerId', { storeId })).length;
    const newCustomersThisMonth = (await Order.distinct('customerId', { storeId, createdAt: { $gte: w30 } })).length;

    // 4. Daily graph – last 30 days
    const dailyGraph = await Order.aggregate([
      { $match: { storeId: oid, paymentStatus: 'paid', createdAt: { $gte: w30 } } },
      { $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }
      }},
      { $sort: { '_id': 1 } }
    ]);

    // 5. Weekly graph – last 12 weeks
    const weeklyGraph = await Order.aggregate([
      { $match: { storeId: oid, paymentStatus: 'paid', createdAt: { $gte: w84 } } },
      { $group: {
        _id:     { $week: '$createdAt' },
        revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }
      }},
      { $sort: { '_id': 1 } }
    ]);

    // 6. Monthly graph – last 12 months
    const monthlyGraph = await Order.aggregate([
      { $match: { storeId: oid, paymentStatus: 'paid', createdAt: { $gte: w365 } } },
      { $group: {
        _id:     { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }
      }},
      { $sort: { '_id': 1 } }
    ]);

    // 7. Order status breakdown
    const statusBreakdown = await Order.aggregate([
      { $match: { storeId: oid } },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);

    // 8. Top products
    const topProducts = await Order.aggregate([
      { $match: { storeId: oid, paymentStatus: 'paid' } },
      { $unwind: '$cart' },
      { $group: {
        _id:         '$cart.productId',
        name:        { $first: '$cart.productName' },
        totalSold:   { $sum: '$cart.quantity' },
        totalRevenue:{ $sum: { $multiply: ['$cart.price', '$cart.quantity'] } }
      }},
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);
    const topWithStock = await Promise.all(topProducts.map(async (p) => {
      const prod = await Product.findById(p._id).select('stock category');
      return { ...p, stock: prod?.stock ?? null, category: prod?.category ?? 'General' };
    }));

    // 9. Low stock
    const lowStock = await Product.find({ storeId, stock: { $lte: 10 } })
      .select('name stock category').limit(5);

    // 10. Recent orders
    const recentOrders = await Order.find({ storeId })
      .sort({ createdAt: -1 }).limit(8)
      .populate('customerId', 'name email').lean();

    // 11. Funnel
    const totalVisits = await Order.countDocuments({ storeId });
    const addedToCart = await Order.countDocuments({ storeId, 'cart.0': { $exists: true } });
    const checkedOut  = await Order.countDocuments({ storeId, paymentStatus: { $in: ['paid', 'pending'] } });
    const purchased   = await Order.countDocuments({ storeId, paymentStatus: 'paid' });

    const aov = t.totalOrders > 0 ? Math.round((t.totalRevenue || 0) / t.totalOrders) : 0;

    res.json({
      overview: {
        totalRevenue: t.totalRevenue || 0, totalOrders: t.totalOrders || 0,
        totalCustomers: uniqueCustomers, activeVisitors,
        today: t.today || 0, yesterday: t.yesterday || 0,
        last7Days: t.last7Days || 0, last30Days: t.last30Days || 0,
        aov, newCustomersThisMonth,
      },
      graphs: { dailyGraph, weeklyGraph, monthlyGraph },
      statusBreakdown, topProducts: topWithStock, lowStock, recentOrders,
      funnel: { totalVisits, addedToCart, checkedOut, purchased },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(400).json({ error: err.message });
  }
});

// For customer app: Fetch ALL stores
router.get('/all/list', async (req, res) => {
  try {
    // Only return minimal data needed for directory
    const stores = await Store.find({}, 'name address phone imageUrl location qrCode isOpen operatingHours category').sort({ createdAt: -1 });
    res.json(stores);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// For customer app: Fetch NEARBY stores
router.post('/nearby', async (req, res) => {
  const { longitude, latitude, maxDistanceInMeters = 50000 } = req.body; // Default 50km
  try {
    if (longitude === undefined || latitude === undefined) {
       return res.status(400).json({ error: 'longitude and latitude are required' });
    }

    const stores = await Store.find({
      location: {
        $near: {
          $geometry: {
             type: 'Point',
             coordinates: [longitude, latitude] // [long, lat] order is required by GeoJSON
          },
          $maxDistance: maxDistanceInMeters
        }
      }
    }, 'name address phone imageUrl location qrCode isOpen operatingHours category');

    res.json(stores);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get customers for store
router.get('/customers/:storeId', async (req, res) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.id !== req.params.storeId) return res.status(403).json({ error: 'Forbidden' });
    const customers = await Customer.find({ storeId: req.params.storeId });
    res.json(customers);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;