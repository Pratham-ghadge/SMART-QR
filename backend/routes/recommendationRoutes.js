const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const router = express.Router();

// Python ML Service URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

// Middleware to verify customer token
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
// 🤖 AI PRODUCT RECOMMENDATIONS (via Python ML Service)
// ===========================
router.get('/:storeId/:productId', verifyToken, async (req, res) => {
    try {
        const { storeId, productId } = req.params;

        // Forward request to Python ML service with auth header
        const authHeader = req.header('Authorization');
        const mlResponse = await axios.get(
            `${ML_SERVICE_URL}/api/recommendations/${storeId}/${productId}`,
            {
                headers: { Authorization: authHeader },
                timeout: 10000,
            }
        );

        res.json(mlResponse.data);
    } catch (err) {
        console.error('ML Recommendation error:', err.message);

        // If ML service is down, return empty recommendations gracefully
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
            console.log('⚠️ ML Service unavailable, returning empty recommendations');
            return res.json({ recommendations: [], model: 'unavailable' });
        }

        const status = err.response?.status || 500;
        const message = err.response?.data?.error || 'Recommendation service error';
        res.status(status).json({ error: message });
    }
});

module.exports = router;
