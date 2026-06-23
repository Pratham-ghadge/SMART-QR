import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';

const CartScreen = ({ navigation, route }) => {
  const [cart, setCart] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [currentStoreId, setCurrentStoreId] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Re-check store entry status every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [route.params?.cart, route.params?.totalAmount])
  );

  const syncCartState = useCallback((updatedCart = [], updatedTotal = 0) => {
    setCart(updatedCart);
    setTotalAmount(updatedTotal);
  }, []);

  const fetchCurrentOrder = useCallback(async (storeId, authToken) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/orders/current-order/${storeId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      syncCartState(response.data.cart || [], response.data.totalAmount || 0);
    } catch (error) {
      console.error('Error fetching current cart:', error.response?.data || error.message);
      syncCartState([], 0);
    }
  }, [syncCartState]);

  const loadData = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('token');
      const savedStoreId = await AsyncStorage.getItem('currentStoreId');
      const savedOrderId = await AsyncStorage.getItem('currentOrderId');

      setToken(savedToken);

      if (savedStoreId && savedStoreId !== 'null' && savedStoreId !== 'undefined' && savedStoreId.trim() !== '') {
        setCurrentStoreId(savedStoreId);
        setCurrentOrderId(savedOrderId);
      } else {
        setCurrentStoreId(null);
        setCurrentOrderId(null);
        syncCartState([], 0);
        return;
      }

      if (route.params?.cart) {
        syncCartState(route.params.cart, route.params.totalAmount || 0);
      }

      if (savedToken && savedStoreId) {
        await fetchCurrentOrder(savedStoreId, savedToken);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsReady(true);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeItem(productId);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/orders/update-quantity`,
        {
          storeId: currentStoreId,
          productId: productId,
          quantity: newQuantity,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      syncCartState(response.data.cart || [], response.data.totalAmount || 0);
    } catch (error) {
      console.error('Error updating quantity:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update quantity');
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (productId) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const response = await axios.post(
              `${API_BASE_URL}/api/orders/remove-product`,
              {
                storeId: currentStoreId,
                productId: productId,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            syncCartState(response.data.cart || [], response.data.totalAmount || 0);
          } catch (error) {
            console.error('Error removing item:', error.response?.data || error.message);
            Alert.alert('Error', 'Failed to remove item');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before proceeding to payment');
      return;
    }

    navigation.navigate('Payment', {
      cart,
      totalAmount,
      orderId: currentOrderId,
      storeId: currentStoreId,
    });
  };

  const renderItem = ({ item }) => {
    // Backend sometimes populates productId as an object
    const pId = typeof item.productId === 'object' ? item.productId._id : item.productId;

    return (
      <View style={styles.cartItem}>
        {/* Product Image / Icon */}
        <View style={styles.itemIcon}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="cube-outline" size={24} color="#6366F1" />
          )}
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemTop}>
            <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
            <TouchableOpacity
              onPress={() => removeItem(pId)}
              disabled={loading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <Text style={styles.itemPrice}>₹{item.price.toFixed(2)} each</Text>

          <View style={styles.itemBottom}>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(pId, item.quantity - 1)}
                disabled={loading}
              >
                <Ionicons name="remove" size={18} color="#6366F1" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(pId, item.quantity + 1)}
                disabled={loading}
              >
                <Ionicons name="add" size={18} color="#6366F1" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtotalText}>
              ₹{(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!isReady || (loading && cart.length === 0)) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  // Cart is locked if user hasn't entered a store yet
  if (!currentStoreId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconBox}>
            <Ionicons name="lock-closed" size={48} color="#94A3B8" />
          </View>
          <Text style={styles.lockedTitle}>Cart is Locked</Text>
          <Text style={styles.lockedHint}>
            You need to enter a store first before you can add products to your cart.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Home', { screen: 'StoreScan' })}
            activeOpacity={0.8}
          >
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Scan Store Entry QR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cart.length > 0 && (
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>{cart.length} items</Text>
          </View>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="cart-outline" size={48} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyHint}>Scan product QR codes to add items</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Home', { screen: 'ProductScan' })}
            activeOpacity={0.8}
          >
            <Ionicons name="scan" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Start Scanning</Text>
          </TouchableOpacity>

          {currentStoreId && (
            <TouchableOpacity
              style={styles.exitQRBtn}
              onPress={() => {
                navigation.navigate('ExitQR', {
                  storeId: currentStoreId,
                  orderId: currentOrderId,
                  totalAmount: 0,
                  transactionId: null,
                });
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.exitQRBtnText}>Generate Exit QR</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            renderItem={renderItem}
            keyExtractor={(item) => typeof item.productId === 'object' ? item.productId._id : item.productId}
            style={styles.cartList}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          />

          {/* Checkout Section */}
          <View style={styles.checkoutSection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Total ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
              </Text>
              <Text style={styles.summaryTotal}>₹{totalAmount.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleCheckout}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.checkoutText}>Proceed to Payment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  itemCountBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  itemCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyIconBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
  },
  exitQRBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 14,
  },
  exitQRBtnText: {
    color: '#D97706',
    fontSize: 15,
    fontWeight: '600',
  },

  // Cart Items
  cartList: {
    flex: 1,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qtyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 28,
    textAlign: 'center',
  },
  subtotalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },

  // Checkout
  checkoutSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  // Primary Button (shared)
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Locked Cart
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  lockedIconBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  lockedHint: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
});

export default CartScreen;
