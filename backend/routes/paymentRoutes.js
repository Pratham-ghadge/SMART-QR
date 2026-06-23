const express = require('express');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_KEY
});

// Middleware to verify user token
const verifyUser = (req, res, next) => {
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
    res.status(401).json({ error: 'Unauthorized: ' + err.message });
  }
};

// Create Razorpay Order
router.post('/create-payment-intent', verifyUser, async (req, res) => {
  try {
    const { totalAmount, storeId } = req.body;

    console.log('📍 Creating Razorpay order:', { totalAmount, storeId, userId: req.userId });

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    const options = {
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${req.userId.toString().slice(-8)}_${Date.now()}`,
      notes: {
        storeId: storeId.toString(),
        customerId: req.userId.toString()
      }
    };

    console.log('Razorpay options:', options);

    const razorpayOrder = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created:', razorpayOrder.id);

    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('❌ Razorpay order creation error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Verify & Confirm Razorpay Payment — stores transaction in Order DB
router.post('/confirm', verifyUser, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, storeId, amount } = req.body;
    const customerId = req.userId;

    console.log('🔐 Verifying payment:', { razorpay_order_id, razorpay_payment_id });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification data' });
    }

    // Verify Razorpay Signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSignature) {
      console.error('❌ Signature verification failed');
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    console.log('✅ Signature verified successfully');

    // Find most recent active order for this customer + store
    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    }).sort({ entryTime: -1 });

    if (!order) {
      console.error('❌ Order not found');
      return res.status(404).json({ error: 'No active order found' });
    }

    // Validate amount matches
    if (Math.abs(amount - order.totalAmount) > 0.01) {
      console.error('❌ Amount mismatch:', { expected: order.totalAmount, received: amount });
      return res.status(400).json({
        error: 'Amount mismatch',
        expectedAmount: order.totalAmount,
        receivedAmount: amount
      });
    }

    // Store transaction details in Order DB
    order.paymentStatus = 'paid';
    order.paymentMethod = 'razorpay';
    order.transactions.push({
      transactionId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount,
      method: 'razorpay',
      signature: razorpay_signature,
      status: 'completed'
    });

    await order.save();

    console.log('✅ Payment saved to order:', order._id);

    res.json({
      message: 'Payment successful',
      orderId: order._id,
      transactionId: razorpay_payment_id,
      storeId: storeId,
      totalAmount: order.totalAmount,
      paymentMethod: 'razorpay'
    });
  } catch (err) {
    console.error('❌ Payment confirm error:', err);
    res.status(400).json({ error: err.message });
  }
});


// Get order payment status
router.get('/order-status/:storeId', verifyUser, async (req, res) => {
  try {
    const customerId = req.userId;
    const { storeId } = req.params;

    const order = await Order.findOne({
      customerId,
      storeId,
      exitTime: null
    });

    if (!order) {
      return res.status(404).json({ error: 'No active order' });
    }

    res.json({
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      cartCount: order.cart.length,
      entryTime: order.entryTime
    });
  } catch (err) {
    console.error('Order status error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
