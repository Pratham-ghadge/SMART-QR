const express = require('express');
const jwt = require('jsonwebtoken');
const Store = require('../models/Store');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

const router = express.Router();

// Middleware: Verify Shopkeeper JWT
const verifyShopkeeper = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if token has either storeId or id (from store login)
    const storeId = decoded.storeId || decoded.id;
    if (!storeId) {
      return res.status(403).json({ message: 'Invalid token: No store ID found' });
    }

    req.storeId = storeId;
    req.shopkeeperId = storeId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

/**
 * ✅ GET /api/shopkeeper/monitor/:storeId
 * Fetch ALL orders for a specific store with customer & product details
 * - Uses indexes for fast query on storeId
 * - Populates customer names from Customer collection
 * - Includes all payment & cart information
 */
router.get('/monitor/:storeId', verifyShopkeeper, async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verify shopkeeper has access to this store
    if (req.storeId !== storeId) {
      return res.status(403).json({ message: 'Unauthorized: Cannot access other stores' });
    }

    console.log(`📊 Fetching orders for store: ${storeId}`);

    // Convert storeId string to ObjectId for proper MongoDB query
    const mongoose = require('mongoose');
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // ✅ INDEXED QUERY: Using storeId index for faster retrieval
    const orders = await Order.find({ storeId: storeObjectId })
      .populate({
        path: 'customerId',
        select: 'name email phone',
        model: 'Customer'
      })
      .populate({
        path: 'cart.productId',
        select: 'name price category stock',
        model: 'Product'
      })
      .sort({ entryTime: -1 })
      .lean()
      .exec();

    console.log(`✅ Found ${orders.length} orders for store ${storeId}`);

    // Transform data for easier frontend consumption
    const formattedOrders = orders.map(order => ({
      orderId: order._id,
      customerId: order.customerId?._id,
      customerName: order.customerId?.name || 'N/A',
      customerEmail: order.customerId?.email || 'N/A',
      customerPhone: order.customerId?.phone || 'N/A',
      entryTime: order.entryTime,
      exitTime: order.exitTime,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      
      // Cart details with product information
      cart: order.cart.map(item => ({
        productId: item.productId?._id,
        productName: item.productId?.name || 'Product',
        price: item.productId?.price || 0,
        quantity: item.quantity,
        category: item.productId?.category || 'N/A',
        stock: item.productId?.stock || 0,
        subtotal: (item.productId?.price || 0) * item.quantity,
        addedAt: item.addedAt
      })),

      // Payment transaction history
      transactions: order.transactions?.map(tx => ({
        transactionId: tx.transactionId,
        amount: tx.amount,
        method: tx.method,
        status: tx.status,
        timestamp: tx.timestamp
      })) || [],

      // Activity logs
      activityLogs: order.activityLogs || [],
      
      createdAt: order.createdAt
    }));

    res.status(200).json({
      success: true,
      totalOrders: formattedOrders.length,
      orders: formattedOrders
    });

  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

/**
 * ✅ GET /api/shopkeeper/monitor/:storeId/active
 * Fetch ONLY ACTIVE orders (no exitTime) - Real-time monitoring
 */
router.get('/monitor/:storeId/active', verifyShopkeeper, async (req, res) => {
  try {
    const { storeId } = req.params;

    if (req.storeId !== storeId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log(`🟢 Fetching ACTIVE orders for store: ${storeId}`);

    // ✅ INDEXED QUERY: Filter by storeId and exitTime=null
    const activeOrders = await Order.find({
      storeId,
      exitTime: null
    })
      .populate('customerId', 'name email phone')
      .populate('cart.productId', 'name price category stock')
      .sort({ entryTime: -1 })
      .lean()
      .exec();

    console.log(`✅ Found ${activeOrders.length} active customers in store ${storeId}`);

    const formattedOrders = activeOrders.map(order => ({
      orderId: order._id,
      customerId: order.customerId._id,
      customerName: order.customerId.name,
      customerEmail: order.customerId.email,
      customerPhone: order.customerId.phone,
      entryTime: order.entryTime,
      timeInStore: Math.round((Date.now() - new Date(order.entryTime).getTime()) / 60000), // Minutes
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      cartSize: order.cart.length,
      cart: order.cart.map(item => ({
        productId: item.productId._id,
        productName: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity,
        subtotal: item.productId.price * item.quantity
      }))
    }));

    res.status(200).json({
      success: true,
      activeCustomers: formattedOrders.length,
      customers: formattedOrders
    });

  } catch (error) {
    console.error('❌ Error fetching active orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active orders',
      error: error.message
    });
  }
});

/**
 * ✅ GET /api/shopkeeper/monitor/:storeId/stats
 * Get summary statistics for the store
 */
router.get('/monitor/:storeId/stats', verifyShopkeeper, async (req, res) => {
  try {
    const { storeId } = req.params;

    if (req.storeId !== storeId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Using aggregation pipeline with indexes for performance
    const stats = await Order.aggregate([
      { $match: { storeId: new require('mongoose').Types.ObjectId(storeId) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          paidOrders: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
          },
          failedOrders: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] }, 1, 0] }
          },
          totalCustomers: { $sum: 1 }, // One order per customer (assuming)
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        paidOrders: 0,
        pendingOrders: 0,
        failedOrders: 0,
        averageOrderValue: 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

/**
 * ✅ GET /api/shopkeeper/monitor/:storeId/filter
 * Filter orders by payment status, date range, etc.
 */
router.get('/monitor/:storeId/filter', verifyShopkeeper, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status, startDate, endDate } = req.query;

    if (req.storeId !== storeId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Build query filter
    const filter = { storeId };
    if (status) filter.paymentStatus = status;
    if (startDate || endDate) {
      filter.entryTime = {};
      if (startDate) filter.entryTime.$gte = new Date(startDate);
      if (endDate) filter.entryTime.$lte = new Date(endDate);
    }

    console.log(`🔍 Filtering orders with:`, filter);

    const filteredOrders = await Order.find(filter)
      .populate('customerId', 'name email phone')
      .populate('cart.productId', 'name price')
      .sort({ entryTime: -1 })
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      count: filteredOrders.length,
      orders: filteredOrders.map(order => ({
        orderId: order._id,
        customerName: order.customerId.name,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        entryTime: order.entryTime,
        cart: order.cart.map(item => ({
          productName: item.productId.name,
          quantity: item.quantity,
          price: item.productId.price
        }))
      }))
    });

  } catch (error) {
    console.error('❌ Error filtering orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error filtering orders',
      error: error.message
    });
  }
});

/**
 * ✅ POST /api/shopkeeper/validate-exit-qr
 * Validates a scanned exit QR code and marks the order as exited.
 */
router.post('/validate-exit-qr', verifyShopkeeper, async (req, res) => {
  try {
    const { qrData } = req.body;
    if (!qrData) {
      return res.status(400).json({ success: false, message: 'No QR data provided' });
    }

    let payload;
    try {
      payload = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid QR code format' });
    }

    // Verify payload structure
    if (payload.type !== 'exit' || !payload.orderId || !payload.storeId) {
      return res.status(400).json({ success: false, message: 'Not a valid exit QR code' });
    }

    // Verify it belongs to the shopkeeper's store
    if (payload.storeId !== req.storeId) {
      return res.status(403).json({ success: false, message: 'This QR code is for a different store' });
    }

    // Find the order
    const order = await Order.findById(payload.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if it's already validated
    if (order.exitTime) {
      return res.status(400).json({ success: false, message: 'QR Code already validated', exitTime: order.exitTime });
    }

    // Check if the order is valid for exit (paid OR empty cart)
    const isPaid = order.paymentStatus === 'paid';
    const isEmptyCart = order.cart.length === 0;

    if (!isPaid && !isEmptyCart) {
      return res.status(400).json({ success: false, message: 'Unpaid items in cart. Customer must pay before exiting.' });
    }

    // Mark as exited
    order.exitTime = new Date();
    
    // If they exit natively with 0 items, explicitly mark payment as completed/not required
    if (isEmptyCart) {
      order.paymentStatus = 'not_required';
    }
    
    await order.save();

    // Deduct stock for all products in the cart since checkout is confirmed
    if (!isEmptyCart) {
      for (const item of order.cart) {
        if (item.productId && item.quantity > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity }
          });
        }
      }
    }

    console.log(`✅ Exit validated for order: ${order._id}`);

    const exitType = isEmptyCart ? 'Empty Cart Exit' : 'Paid Purchase Exit';

    res.status(200).json({
      success: true,
      message: `QR code successfully validated! (${exitType})`,
      orderId: order._id,
      exitType
    });

  } catch (error) {
    console.error('❌ Error validating exit QR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: error.message
    });
  }
});

module.exports = router;
