const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load .env BEFORE importing routes (routes use process.env at load time)
dotenv.config();

const customerRoutes = require('./routes/customerRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const shopkeeperRoutes = require('./routes/shopkeeperRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

app.use('/api/customers', customerRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shopkeeper', shopkeeperRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'smart-qr-backend', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));