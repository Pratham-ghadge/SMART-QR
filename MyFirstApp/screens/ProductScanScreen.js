import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import API_BASE_URL from '../config';
import { playBeep } from '../utils/beep';
import RecommendationModal from './RecommendationModal';

const ProductScanScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [currentStoreId, setCurrentStoreId] = useState(null);
  const [token, setToken] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [scannedProductName, setScannedProductName] = useState('');

  // Refresh cart/order data every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadStorageData();
    }, [])
  );

  const loadStorageData = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('token');
      const savedOrderId = await AsyncStorage.getItem('currentOrderId');
      const savedStoreId = await AsyncStorage.getItem('currentStoreId');

      setToken(savedToken);
      setCurrentOrderId(savedOrderId);
      setCurrentStoreId(savedStoreId);

      if (!savedOrderId || !savedStoreId) {
        Alert.alert('Error', 'No active order. Please scan store entry QR first.');
        navigation.goBack();
        return;
      }

      fetchCurrentOrder(savedOrderId, savedStoreId, savedToken);
    } catch (error) {
      console.error('Failed to load storage data:', error);
    }
  };

  const fetchCurrentOrder = async (orderId, storeId, authToken) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/orders/current-order/${storeId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.cart) {
        setCart(response.data.cart);
        setTotalAmount(response.data.totalAmount);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (!scanning || loading) return;

    setScanning(false);
    setLoading(true);

    try {
      const qrData = data.trim();
      console.log('QR received:', qrData);

      if (qrData.startsWith('store-')) {
        setLoading(false);
        Alert.alert(
          'Wrong QR Code Pattern',
          'You scanned a Store Entry QR code!\n\nPlease point the camera at a valid Product QR code to add items to your cart.',
          [{ text: 'OK', onPress: () => setScanning(true) }]
        );
        return;
      }

      let productId = qrData;
      if (qrData.includes('-')) {
        const parts = qrData.split('-');
        productId = parts[parts.length - 1];
      }
      console.log('Extracted product ID:', productId);

      const response = await axios.post(
        `${API_BASE_URL}/api/orders/scan-product`,
        {
          storeId: currentStoreId,
          productId: productId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCart(response.data.cart);
      setTotalAmount(response.data.totalAmount);
      setLoading(false);

      playBeep();

      const addedProductName = response.data.product.name;
      const addedProductId = productId;

      Alert.alert(
        'Product Added',
        `${addedProductName} added to cart!\n₹${response.data.product.price}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setScanning(true);
              fetchRecommendations(currentStoreId, addedProductId, addedProductName);
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Product scan error:', error.response?.data || error.message);
      setLoading(false);

      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to add product to cart',
        [
          {
            text: 'OK',
            onPress: () => setScanning(true),
          },
        ],
        { cancelable: false }
      );
    }
  };

  const fetchRecommendations = async (storeId, productId, productName) => {
    try {
      setRecLoading(true);
      setScannedProductName(productName);
      setShowRecommendations(true);

      const res = await axios.get(
        `${API_BASE_URL}/api/recommendations/${storeId}/${productId}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );

      setRecommendations(res.data.recommendations || []);
    } catch (err) {
      console.log('Recommendations fetch error:', err.message);
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  };

  const handleAddRecommended = async (product) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/orders/scan-product`,
        { storeId: currentStoreId, productId: product._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCart(res.data.cart);
      setTotalAmount(res.data.totalAmount);
      playBeep();

      // Remove added product from recommendations list
      setRecommendations(prev => prev.filter(p => p._id !== product._id));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not add product');
    }
  };

  const handleViewCart = () => {
    navigation.navigate('Cart', {
      cart,
      totalAmount,
      orderId: currentOrderId,
      storeId: currentStoreId,
    });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permContainer}>
        <View style={styles.permContent}>
          <View style={styles.permIconBox}>
            <Ionicons name="camera-outline" size={40} color="#EF4444" />
          </View>
          <Text style={styles.permTitle}>Camera Permission Required</Text>
          <Text style={styles.permDesc}>We need camera access to scan product QR codes</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Scan Products</Text>
        <TouchableOpacity onPress={handleViewCart}>
          <View style={styles.cartBadge}>
            <Ionicons name="cart" size={22} color="#FFFFFF" />
            {cart.length > 0 && (
              <View style={styles.cartCount}>
                <Text style={styles.cartCountText}>{cart.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Camera */}
      {scanning ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : (
        <View style={styles.placeholderCamera}>
          {loading && (
            <>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Adding to cart…</Text>
            </>
          )}
        </View>
      )}

      {/* Scanner Frame */}
      <View style={styles.scannerOverlay} pointerEvents="none">
        <View style={styles.scannerFrame}>
          <View style={[styles.scannerCorner, styles.cornerTL]} />
          <View style={[styles.scannerCorner, styles.cornerTR]} />
          <View style={[styles.scannerCorner, styles.cornerBL]} />
          <View style={[styles.scannerCorner, styles.cornerBR]} />
        </View>
      </View>

      {/* Bottom Overlay */}
      <View style={styles.bottomOverlay}>
        <View style={styles.cartSummary}>
          <View style={styles.summaryLeft}>
            <Ionicons name="bag-handle-outline" size={18} color="#94A3B8" />
            <Text style={styles.itemCount}>{cart.length} items</Text>
          </View>
          <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.viewCartBtn}
          onPress={handleViewCart}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="cart" size={20} color="#FFFFFF" />
          <Text style={styles.viewCartText}>View Cart ({cart.length})</Text>
        </TouchableOpacity>
      </View>

      {/* AI Recommendation Modal */}
      <RecommendationModal
        visible={showRecommendations}
        recommendations={recommendations}
        scannedProductName={scannedProductName}
        loading={recLoading}
        onAddToCart={handleAddRecommended}
        onDismiss={() => setShowRecommendations(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  permContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  permDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 10,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cartBadge: {
    position: 'relative',
  },
  cartCount: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Camera
  placeholderCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  loadingText: {
    color: '#CBD5E1',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '500',
  },

  // Scanner overlay
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  scannerFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#6366F1',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },

  // Bottom
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,23,42,0.92)',
    backdropFilter: 'blur(10px)',
    padding: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cartSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemCount: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  totalAmount: {
    color: '#10B981',
    fontSize: 20,
    fontWeight: '700',
  },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Shared
  primaryBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProductScanScreen;