const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.customerId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

// Verify Token & Check Customer (For Auto-Login)
router.post('/verify-token', verifyToken, async (req, res) => {
  try {
    // Check if customer still exists in database
    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(401).json({ error: 'Customer not found - Please register' });
    }

    res.json({
      message: 'Token valid',
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ error: 'Token verification failed' });
  }
});

// Customer Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create customer
    const customer = new Customer({
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      isLoggedIn: false
    });

    await customer.save();

    res.status(201).json({
      message: 'Customer registered successfully',
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (err) {
    console.error('Customer registration error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Customer Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find customer
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, customer.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: customer._id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '30d' }
    );

    // Update login status
    customer.isLoggedIn = true;
    await customer.save();

    res.json({
      message: 'Login successful',
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get Customer Profile
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    const customer = await Customer.findById(decoded.id).select('-password');
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Update Customer Profile
router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    const { name, phone } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      decoded.id,
      {
        name: name || undefined,
        phone: phone || undefined
      },
      { new: true }
    ).select('-password');

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      customer
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    const customer = await Customer.findByIdAndUpdate(decoded.id, { isLoggedIn: false });

    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
