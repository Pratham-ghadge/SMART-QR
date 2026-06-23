"""
AI/ML Product Recommendation Service for SmartQR
Uses scikit-learn for content-based filtering + collaborative filtering
"""

import os
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from dotenv import load_dotenv

# ─── Robust DNS Fix for MongoDB Atlas ───
import dns.resolver
try:
    # Force use Google DNS (8.8.8.8) or Cloudflare (1.1.1.1) to avoid local DNS timeouts
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']
    dns.resolver.default_resolver.lifetime = 10  # 10s timeout
    print("🌐 Using Google DNS for MongoDB SRV resolution")
except Exception as e:
    print(f"⚠️ Could not override DNS: {e}")

# Load .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── MongoDB Connection ───
MONGO_URI = os.environ.get('MONGO_URI')
if not MONGO_URI:
    print('❌ MONGO_URI environment variable is required!')
    exit(1)

client = MongoClient(MONGO_URI)

# Determine the database to use
try:
    db = client.get_default_database()
except Exception:
    # Atlas SRV URI without a default database: pick the first non-system one
    db_names = [name for name in client.list_database_names() if name not in ('admin', 'local', 'config')]
    db = client[db_names[0]] if db_names else client['test']

print(f"✅ Connected to MongoDB database: {db.name}")


# ─── Helper: Convert ObjectId to string ───
def serialize_product(product):
    """Convert MongoDB product document to JSON-serializable dict."""
    return {
        '_id': str(product['_id']),
        'name': product.get('name', 'Unknown'),
        'price': product.get('price', 0),
        'category': product.get('category', 'General'),
        'imageUrl': product.get('imageUrl', None),
        'stock': product.get('stock', 0),
        'description': product.get('description', ''),
    }


# ─── ML Engine ───
class RecommendationEngine:
    """
    Hybrid recommendation engine combining:
    1. Content-Based Filtering (TF-IDF + Cosine Similarity on product features)
    2. Collaborative Filtering (Co-purchase patterns from order history)
    3. Popularity-based scoring
    4. Price proximity scoring
    """

    def get_recommendations(self, store_id, product_id, customer_id, top_n=6):
        """Generate top N product recommendations for a scanned product."""

        # 1. Fetch the scanned product
        try:
            scanned_product = db.products.find_one({'_id': ObjectId(product_id)})
        except Exception:
            return {'error': 'Invalid product ID'}, 404

        if not scanned_product:
            return {'error': 'Scanned product not found'}, 404

        # 2. Get customer's current cart to exclude those items
        cart_product_ids = set()
        active_order = db.orders.find_one(
            {'customerId': ObjectId(customer_id), 'storeId': ObjectId(store_id), 'exitTime': None},
            sort=[('entryTime', -1)]
        )
        if active_order and 'cart' in active_order:
            cart_product_ids = {str(item['productId']) for item in active_order['cart']}

        # 3. Get all in-stock products in the same store (exclude scanned + cart)
        exclude_ids = {product_id} | cart_product_ids
        exclude_object_ids = [ObjectId(pid) for pid in exclude_ids if ObjectId.is_valid(pid)]

        candidates = list(db.products.find({
            'storeId': ObjectId(store_id),
            '_id': {'$nin': exclude_object_ids},
            'stock': {'$gt': 0}
        }))

        if not candidates:
            return {'recommendations': [], 'scannedProduct': {
                'name': scanned_product.get('name', ''),
                'category': scanned_product.get('category', 'General')
            }}, 200

        # ─────────────────────────────────────────
        # SCORE 1: Content-Based Filtering (TF-IDF)
        # ─────────────────────────────────────────
        content_scores = self._content_based_scores(scanned_product, candidates)

        # ─────────────────────────────────────────
        # SCORE 2: Collaborative Filtering (Co-purchase)
        # ─────────────────────────────────────────
        collab_scores = self._collaborative_scores(store_id, product_id, candidates)

        # ─────────────────────────────────────────
        # SCORE 3: Popularity Score
        # ─────────────────────────────────────────
        popularity_scores = self._popularity_scores(store_id, candidates)

        # ─────────────────────────────────────────
        # SCORE 4: Price Proximity Score
        # ─────────────────────────────────────────
        price_scores = self._price_proximity_scores(scanned_product, candidates)

        # ─────────────────────────────────────────
        # COMBINE: Weighted Hybrid Score
        # ─────────────────────────────────────────
        # Weights: Content=0.35, Collaborative=0.30, Popularity=0.20, Price=0.15
        WEIGHTS = {
            'content': 0.35,
            'collaborative': 0.30,
            'popularity': 0.20,
            'price': 0.15
        }

        scored_products = []
        for i, product in enumerate(candidates):
            final_score = (
                content_scores[i] * WEIGHTS['content'] +
                collab_scores[i] * WEIGHTS['collaborative'] +
                popularity_scores[i] * WEIGHTS['popularity'] +
                price_scores[i] * WEIGHTS['price']
            )

            # Build human-readable reasons
            reasons = self._build_reasons(
                content_scores[i], collab_scores[i],
                popularity_scores[i], price_scores[i],
                scanned_product, product
            )

            scored_products.append({
                **serialize_product(product),
                'score': round(final_score * 100, 1),  # Convert to percentage
                'reasons': reasons
            })

        # Sort by score descending and return top N
        scored_products.sort(key=lambda x: x['score'], reverse=True)
        top_recommendations = scored_products[:top_n]

        return {
            'scannedProduct': {
                'name': scanned_product.get('name', ''),
                'category': scanned_product.get('category', 'General')
            },
            'recommendations': top_recommendations,
            'model': 'hybrid-tfidf-collaborative-v1'
        }, 200

    def _content_based_scores(self, scanned_product, candidates):
        """
        Use TF-IDF vectorization on product name + category + description
        then compute cosine similarity with the scanned product.
        """
        def build_text(p):
            parts = []
            name = p.get('name', '')
            category = p.get('category', '')
            description = p.get('description', '')
            # Repeat category to give it more weight
            parts.append(name)
            parts.append(category + ' ' + category + ' ' + category)
            parts.append(description)
            return ' '.join(parts).lower().strip()

        # Build corpus: first element is the scanned product
        corpus = [build_text(scanned_product)]
        for product in candidates:
            corpus.append(build_text(product))

        # TF-IDF Vectorization
        vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=500,
            ngram_range=(1, 2)
        )

        try:
            tfidf_matrix = vectorizer.fit_transform(corpus)
            # Cosine similarity between scanned product (index 0) and all candidates
            similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        except ValueError:
            # Fallback if corpus is too small or empty
            similarities = np.zeros(len(candidates))

        return similarities.tolist()

    def _collaborative_scores(self, store_id, product_id, candidates):
        """
        Collaborative filtering based on co-purchase patterns.
        Find orders that contain the scanned product and count
        how often each candidate appears alongside it.
        """
        # Find past paid orders containing the scanned product
        past_orders = list(db.orders.find({
            'storeId': ObjectId(store_id),
            'paymentStatus': 'paid',
            'cart.productId': ObjectId(product_id)
        }, {'cart': 1}).limit(200))

        # Build co-purchase frequency map
        co_purchase_counts = {}
        for order in past_orders:
            for item in order.get('cart', []):
                item_id = str(item['productId'])
                if item_id != product_id:
                    co_purchase_counts[item_id] = co_purchase_counts.get(item_id, 0) + 1

        if not co_purchase_counts:
            return [0.0] * len(candidates)

        max_count = max(co_purchase_counts.values())
        scores = []
        for product in candidates:
            pid = str(product['_id'])
            count = co_purchase_counts.get(pid, 0)
            scores.append(count / max_count if max_count > 0 else 0.0)

        return scores

    def _popularity_scores(self, store_id, candidates):
        """
        Score products by how frequently they appear in past orders
        (overall popularity in the store).
        """
        all_orders = list(db.orders.find({
            'storeId': ObjectId(store_id),
            'paymentStatus': 'paid'
        }, {'cart': 1}).limit(300))

        purchase_counts = {}
        for order in all_orders:
            for item in order.get('cart', []):
                item_id = str(item['productId'])
                qty = item.get('quantity', 1)
                purchase_counts[item_id] = purchase_counts.get(item_id, 0) + qty

        if not purchase_counts:
            return [0.0] * len(candidates)

        max_count = max(purchase_counts.values())
        scores = []
        for product in candidates:
            pid = str(product['_id'])
            count = purchase_counts.get(pid, 0)
            scores.append(count / max_count if max_count > 0 else 0.0)

        return scores

    def _price_proximity_scores(self, scanned_product, candidates):
        """
        Score products by how close their price is to the scanned product.
        Uses inverse normalized distance.
        """
        scanned_price = scanned_product.get('price', 0)
        if scanned_price <= 0:
            return [0.5] * len(candidates)

        prices = [p.get('price', 0) for p in candidates]
        if not prices:
            return []

        diffs = [abs(p - scanned_price) for p in prices]
        max_diff = max(diffs) if max(diffs) > 0 else 1.0

        scores = [1.0 - (d / max_diff) for d in diffs]
        return scores

    def _build_reasons(self, content_score, collab_score, pop_score, price_score, scanned, candidate):
        """Build human-readable reason tags for the recommendation."""
        reasons = []

        # Category match check
        sc = scanned.get('category', '').lower().strip()
        cc = candidate.get('category', '').lower().strip()
        if sc and cc and sc == cc:
            reasons.append('Same Category')

        if collab_score >= 0.3:
            reasons.append('Frequently Bought Together')

        if pop_score >= 0.4:
            reasons.append('Popular in Store')

        if price_score >= 0.7:
            reasons.append('Similar Price')

        if content_score >= 0.3 and 'Same Category' not in reasons:
            reasons.append('Similar Product')

        if not reasons:
            reasons.append('Available in Store')

        return reasons[:3]  # Max 3 reasons


# ─── Singleton engine instance ───
engine = RecommendationEngine()


# ─── API Endpoint ───
@app.route('/api/recommendations/<store_id>/<product_id>', methods=['GET'])
def get_recommendations(store_id, product_id):
    """Get AI-powered product recommendations."""
    # Get customer ID from auth header
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return jsonify({'error': 'No authorization header'}), 401

    # Decode JWT to get customer ID
    import jwt as pyjwt
    token = auth_header.replace('Bearer ', '').strip()
    try:
        # Use the secret from .env/backend (your_jwt_secret_here)
        secret = os.environ.get('JWT_SECRET', 'your_jwt_secret_here')
        decoded = pyjwt.decode(token, secret, algorithms=['HS256'])
        customer_id = decoded.get('id')
    except Exception as e:
        return jsonify({'error': f'Invalid token: {str(e)}'}), 401

    if not customer_id:
        return jsonify({'error': 'Customer ID not found in token'}), 401

    result, status_code = engine.get_recommendations(store_id, product_id, customer_id)
    return jsonify(result), status_code


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'running',
        'service': 'SmartQR ML Recommendation Engine',
        'model': 'hybrid-tfidf-collaborative-v1',
        'database': db.name
    })


if __name__ == '__main__':
    PORT = int(os.environ.get('ML_PORT', 5001))
    HOST = os.environ.get('ML_HOST', '0.0.0.0')
    DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    print(f"🤖 ML Recommendation Service starting on http://{HOST}:{PORT}")
    print(f"📊 Model: Hybrid TF-IDF + Collaborative Filtering v1")
    app.run(host=HOST, port=PORT, debug=DEBUG)
