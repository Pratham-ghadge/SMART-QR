const express = require('express');
const jwt = require('jsonwebtoken');
const qrcode = require('qrcode');
const Order = require('../models/Order');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

const router = express.Router();

// Helper function to extract ID from formatted QR
const extractId = (qrData) => {
  if (!qrData) return null;
  // Handle formats: "product-XXXXX", "store-XXXXX", or just "XXXXX"
  const trimmed = String(qrData).trim();
  
  // If contains hyphen, get last part after split
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    const result = parts[parts.length - 1];
    console.log(`extractId: "${trimmed}" → "${result}"`);
    return result;
  }
  
  console.log(`extractId: "${trimmed}" (no change)`);
  return trimmed;
};

// Middleware to verify token
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ===========================
// 🟢 STEP 1: ENTRY SCAN
// ===========================
router.post('/entry', verifyToken, async (req, res) => {
  try {
    let { storeId } = req.body;
    const customerId = req.userId;

    // ✅ Extract ID from formatted QR
    storeId = extractId(storeId);
    console.log('📍 Processing store entry for storeId:', storeId);

    if (!storeId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // Validate store exists
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Validate customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // ✅ FIXED: ALWAYS CREATE NEW ORDER - Never reuse, keep all previous entries
    const order = new Order({
      storeId,
      customerId,
      cart: [],
      totalAmount: 0,
      paymentStatus: 'pending'
    });

    await order.save();

    console.log('✅ New order created:', order._id);
    res.json({
      message: 'Entry successful',
      orderId: order._id,
      entryTime: order.entryTime
    });
  } catch (err) {
    console.error('Entry scan error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ===========================
// 🟡 STEP 2: PRODUCT SCAN
// ===========================
router.post('/scan-product', verifyToken, async (req, res) => {
  try {
    let { storeId, productId } = req.body;
    const customerId = req.userId;

    // ✅ FIXED: Extract actual ID from formatted QR strings
    storeId = extractId(storeId);
    productId = extractId(productId);

    console.log('🔍 Extracted IDs:', { storeId, productId });

    // Validate IDs
    if (!storeId || !productId) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    // ✅ FIXED: Find MOST RECENT active order (in case of multiple concurrent orders)
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    }).sort({ entryTime: -1 });

    if (!order) {
      return res.status(400).json({ 
        error: 'No active order found. Please scan entry QR first.' 
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Prevent cross-shop scanning
    if (product.storeId.toString() !== storeId) {
      return res.status(400).json({ 
        error: 'Product does not belong to this store' 
      });
    }

    // Check stock availability
    if (product.stock <= 0) {
      return res.status(400).json({ 
        error: 'Product out of stock' 
      });
    }

    // Check if product already in cart
    const existingItem = order.cart.find(
      item => item.productId.toString() === productId
    );

    if (existingItem) {
      // Increase quantity
      const newQuantity = existingItem.quantity + 1;
      if (newQuantity > product.stock) {
        return res.status(400).json({ 
          error: `Only ${product.stock} items available in stock` 
        });
      }
      existingItem.quantity = newQuantity;

      // Add activity log
      order.activityLogs.push({
        action: 'INCREASE',
        productId,
        productName: product.name,
        quantity: newQuantity
      });
    } else {
      // Add new item to cart
      order.cart.push({
        productId,
        productName: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: 1
      });

      // Add activity log
      order.activityLogs.push({
        action: 'ADD',
        productId,
        productName: product.name,
        quantity: 1
      });
    }

    // Recalculate total amount
    order.totalAmount = order.cart.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );

    await order.save();

    res.json({
      message: 'Product added to cart successfully',
      product: {
        name: product.name,
        price: product.price
      },
      cart: order.cart,
      totalAmount: order.totalAmount
    });
  } catch (err) {
    console.error('Product scan error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ===========================
// 🔄 STEP 3: CART OPERATIONS
// ===========================

// Update quantity
router.post('/update-quantity', verifyToken, async (req, res) => {
  try {
    let { storeId, productId, quantity } = req.body;
    const customerId = req.userId;

    // ✅ FIXED: Extract actual ID from formatted QR strings
    storeId = extractId(storeId);
    productId = extractId(productId);

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    // ✅ FIXED: Find MOST RECENT active order
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    }).sort({ entryTime: -1 });

    if (!order) {
      return res.status(400).json({ error: 'No active order found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check stock
    if (quantity > product.stock) {
      return res.status(400).json({ 
        error: `Only ${product.stock} items available` 
      });
    }

    // Find and update item
    const cartItem = order.cart.find(
      item => item.productId.toString() === productId
    );

    if (!cartItem) {
      return res.status(404).json({ error: 'Item not in cart' });
    }

    const oldQuantity = cartItem.quantity;
    cartItem.quantity = quantity;

    // Add activity log
    if (quantity > oldQuantity) {
      order.activityLogs.push({
        action: 'INCREASE',
        productId,
        productName: product.name,
        quantity
      });
    } else {
      order.activityLogs.push({
        action: 'DECREASE',
        productId,
        productName: product.name,
        quantity
      });
    }

    // Recalculate total
    order.totalAmount = order.cart.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );

    await order.save();

    res.json({
      message: 'Quantity updated successfully',
      cart: order.cart,
      totalAmount: order.totalAmount
    });
  } catch (err) {
    console.error('Update quantity error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Remove product from cart
router.post('/remove-product', verifyToken, async (req, res) => {
  try {
    let { storeId, productId } = req.body;
    const customerId = req.userId;

    // ✅ FIXED: Extract actual ID from formatted QR strings
    storeId = extractId(storeId);
    productId = extractId(productId);

    // ✅ FIXED: Find MOST RECENT active order
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    }).sort({ entryTime: -1 });

    if (!order) {
      return res.status(400).json({ error: 'No active order found' });
    }

    const product = await Product.findById(productId);

    // Remove from cart
    const initialLength = order.cart.length;
    order.cart = order.cart.filter(
      item => item.productId.toString() !== productId
    );

    if (order.cart.length === initialLength) {
      return res.status(404).json({ error: 'Item not in cart' });
    }

    // Add activity log
    order.activityLogs.push({
      action: 'REMOVE',
      productId,
      productName: product?.name || 'Unknown',
      quantity: 0
    });

    // Recalculate total
    order.totalAmount = order.cart.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );

    await order.save();

    res.json({
      message: 'Product removed from cart',
      cart: order.cart,
      totalAmount: order.totalAmount
    });
  } catch (err) {
    console.error('Remove product error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get current order/cart
router.get('/current-order/:storeId', verifyToken, async (req, res) => {
  try {
    const customerId = req.userId;
    const { storeId } = req.params;

    // ✅ FIXED: Find MOST RECENT active order
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    }).sort({ entryTime: -1 }).populate('cart.productId', 'name price stock');

    if (!order) {
      return res.status(404).json({ error: 'No active order' });
    }

    res.json(order);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ===========================
// 💰 STEP 4: PAYMENT PROCESSING
// ===========================
router.post('/process-payment', verifyToken, async (req, res) => {
  try {
    const { storeId, amount, paymentMethod } = req.body;
    const customerId = req.userId;

    // ✅ FIXED: Find MOST RECENT active order
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    }).sort({ entryTime: -1 });

    if (!order) {
      return res.status(400).json({ error: 'No active order found' });
    }

    // Validate amount
    if (amount !== order.totalAmount) {
      return res.status(400).json({ 
        error: 'Amount mismatch',
        expectedAmount: order.totalAmount,
        receivedAmount: amount
      });
    }

    // Process payment (simulate)
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.transactions.push({
      transactionId,
      amount,
      method: paymentMethod,
      status: 'completed'
    });

    await order.save();

    res.json({
      message: 'Payment processed successfully',
      transactionId,
      orderId: order._id
    });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ===========================
// 🔵 STEP 5: EXIT QR GENERATION
// ===========================
router.post('/generate-exit-qr', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.body;
    const customerId = req.userId;

    console.log('📱 Generating exit QR:', { storeId, customerId });

    // Find most recent active order (paid or pending with empty cart)
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    })
      .sort({ entryTime: -1 })
      .populate('cart.productId', 'name price');

    if (!order) {
      return res.status(400).json({ 
        error: 'No active order found for this store' 
      });
    }

    // Build QR payload based on whether payment was made
    const exitQRPayload = {
      type: 'exit',
      orderId: order._id.toString(),
      storeId: storeId,
      customerId: customerId,
      timestamp: Date.now()
    };

    // If payment was made, include transaction details
    const isPaidPurchase = order.transactions.length > 0 && order.cart.length > 0;
    if (isPaidPurchase) {
      const transaction = order.transactions[order.transactions.length - 1];
      exitQRPayload.transactionId = transaction.transactionId;
      exitQRPayload.signature = transaction.signature;
    }

    // Generate QR code
    const exitQR = await qrcode.toDataURL(JSON.stringify(exitQRPayload));
    
    // Store in order DB
    order.exitQR = exitQR;
    await order.save();

    console.log('✅ Exit QR generated and saved for order:', order._id);

    // ✅ SEND EMAIL RECEIPT (Only to customers who made a purchase)
    if (isPaidPurchase) {
      try {
        const { sendReceiptEmail } = require('../utils/emailService');
        const customer = await Customer.findById(customerId);
        const store = await Store.findById(storeId);
        
        if (customer && customer.email && store) {
          console.log(`📠 Sending PDF receipt to ${customer.email} behind the scenes...`);
          // Unawaited to prevent blocking the HTTP response
          sendReceiptEmail(order, customer, store);
        }
      } catch (err) {
        console.error('⚠️ Could not trigger email receipt:', err.message);
      }
    }

    res.json({
      message: 'Exit QR generated successfully',
      exitQR: exitQR,
      orderId: order._id
    });
  } catch (err) {
    console.error('❌ Exit QR generation error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ===========================
// 🚪 STEP 6: EXIT VERIFICATION
// ===========================
router.get('/status/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.userId;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.customerId.toString() !== customerId) {
      return res.status(403).json({ error: 'Unauthorized access to this order' });
    }

    res.json({
      orderId: order._id,
      exitTime: order.exitTime,
      paymentStatus: order.paymentStatus
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// ===========================
router.post('/verify-exit', async (req, res) => {
  try {
    const { exitQRData } = req.body;

    // Parse QR data
    let qrPayload;
    try {
      qrPayload = JSON.parse(exitQRData);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid QR format' });
    }

    // Validate QR type
    if (qrPayload.type !== 'exit') {
      return res.status(400).json({ error: 'Invalid QR type' });
    }

    // Find order
    const order = await Order.findById(qrPayload.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Validate all fields
    if (order.storeId.toString() !== qrPayload.storeId) {
      return res.status(400).json({ error: 'Store ID mismatch' });
    }

    if (order.customerId.toString() !== qrPayload.customerId) {
      return res.status(400).json({ error: 'Customer ID mismatch' });
    }

    // Check if exit already done
    if (order.exitTime) {
      return res.status(400).json({ error: 'Order already exited' });
    }

    // Allow exit for paid orders OR empty carts
    const isPaid = order.paymentStatus === 'paid';
    const isEmptyCart = order.cart.length === 0;

    if (!isPaid && !isEmptyCart) {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Validate transaction only if there's a transactionId in the QR payload
    if (qrPayload.transactionId) {
      const transaction = order.transactions.find(
        t => t.transactionId === qrPayload.transactionId
      );
      if (!transaction) {
        return res.status(400).json({ error: 'Invalid transaction' });
      }
    }

    // Mark as exited
    order.exitTime = new Date();

    if (isEmptyCart) {
      order.paymentStatus = 'not_required';
    }

    await order.save();

    // Deduct stock for all products in the cart
    if (!isEmptyCart) {
      for (const item of order.cart) {
        if (item.productId && item.quantity > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity }
          });
        }
      }
    }

    res.json({
      message: 'Exit verified successfully',
      orderId: order._id,
      exitTime: order.exitTime
    });
  } catch (err) {
    console.error('Exit verification error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ===========================
// 📊 MONITOR CUSTOMERS
// ===========================
router.get('/monitor/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const token = req.header('Authorization')?.replace('Bearer ', '') || '';

    // Verify store ownership
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      const store = await Store.findById(storeId);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get active orders (customers still shopping)
    const activeOrders = await Order.find({
      storeId,
      exitTime: null
    }).populate('customerId', 'name email phone').populate('cart.productId', 'name price');

    res.json({
      message: 'Active customers',
      totalActive: activeOrders.length,
      customers: activeOrders.map(order => ({
        orderId: order._id,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        customerEmail: order.customerId.email,
        customerPhone: order.customerId.phone,
        entryTime: order.entryTime,
        cart: order.cart,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        itemsCount: order.cart.length,
        activityLogs: order.activityLogs
      }))
    });
  } catch (err) {
    console.error('Monitor error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
