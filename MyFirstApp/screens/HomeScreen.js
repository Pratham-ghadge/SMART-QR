import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Camera, CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';
import { playBeep } from '../utils/beep';

const HomeScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeEntered, setStoreEntered] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  
  // Custom directory state
  const [showingStores, setShowingStores] = useState(false);
  const [storesList, setStoresList] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const requestNearbyStores = async () => {
    setDirectoryLoading(true);
    setShowingStores(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        const fallback = await axios.get(`${API_BASE_URL}/api/stores/all/list`);
        setStoresList(fallback.data);
      } else {
        const location = await Location.getCurrentPositionAsync({});
        const res = await axios.post(`${API_BASE_URL}/api/stores/nearby`, {
          longitude: location.coords.longitude,
          latitude: location.coords.latitude,
          maxDistanceInMeters: 50000 // 50km radius
        });
        setStoresList(res.data);
      }
    } catch (err) {
      console.warn("Location error, heavily falling back to all stores...", err.message);
      try {
        const fallback = await axios.get(`${API_BASE_URL}/api/stores/all/list`);
        setStoresList(fallback.data);
      } catch (fError) {
        Alert.alert('Error', 'Could not load stores directory.');
      }
    } finally {
      setDirectoryLoading(false);
    }
  };

  const fetchAllStores = async () => {
    setDirectoryLoading(true);
    setShowingStores(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/stores/all/list`);
      setStoresList(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not fetch stores.');
    } finally {
      setDirectoryLoading(false);
    }
  };

  // Sync state across tabs / app restarts
  useFocusEffect(
    React.useCallback(() => {
      const checkActiveStore = async () => {
        const storeId = await AsyncStorage.getItem('currentStoreId');
        if (storeId) {
          setStoreEntered(true);
          const storeStr = await AsyncStorage.getItem('currentStore');
          if (storeStr) {
            try {
              const storeObj = JSON.parse(storeStr);
              setStoreName(storeObj.name || 'Store');
            } catch (e) {
              setStoreName('Store');
            }
          }
        } else {
          setStoreEntered(false);
          setStoreName('');
        }
      };
      checkActiveStore();
    }, [])
  );

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      console.log('QR Data received:', data);

      let storeId = data.trim();

      if (storeId.startsWith('http://') || storeId.startsWith('https://')) {
        try {
          const url = new URL(storeId);
          const segments = url.pathname.split('/').filter(Boolean);
          storeId = segments.pop() || storeId;
        } catch (urlErr) {
          // ignore; keep original value
        }
      }

      if (storeId.includes('-')) {
        const parts = storeId.split('-');
        storeId = parts[parts.length - 1];
      }

      const token = await AsyncStorage.getItem('token');

      const storeResponse = await axios.get(`${API_BASE_URL}/api/stores/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      if (!storeResponse.data) {
        throw new Error('Store not found');
      }

      const orderResponse = await axios.post(
        `${API_BASE_URL}/api/orders/entry`,
        { storeId },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      if (orderResponse.data.orderId) {
        playBeep();
        await AsyncStorage.setItem('currentStoreId', storeId);
        await AsyncStorage.setItem('currentOrderId', orderResponse.data.orderId);
        await AsyncStorage.setItem('currentStore', JSON.stringify(storeResponse.data));
        setStoreName(storeResponse.data.name || 'Store');
        setStoreEntered(true);
        setShowCamera(false);
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      console.log('Store scan error:', err.response?.data || err.message);

      const errorMsg = err.response?.data?.error || 'Store not found or invalid QR code';
      Alert.alert('Error', errorMsg, [
        { text: 'Retry', onPress: () => { setScanned(false); } },
      ]);
    }
  };

  // ── PERMISSION STATES ──
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.permissionText}>Requesting camera permission…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.centerContent}>
          <View style={styles.permIconBox}>
            <Ionicons name="camera-outline" size={40} color="#EF4444" />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>
            We need your camera to scan QR codes at stores
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => Camera.requestCameraPermissionsAsync()}
          >
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── CAMERA VIEW (after tapping Scan Entry QR) ──
  if (showCamera && !storeEntered) {
    return (
      <View style={styles.cameraFullContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => { setShowCamera(false); setScanned(false); }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.cameraHeaderTitle}>Scan Store Entry QR</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.cameraViewContainer}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barCodeScannerSettings={{
              barCodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          {/* Scanner Frame Overlay */}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame}>
              <View style={[styles.scannerCorner, styles.cornerTL]} />
              <View style={[styles.scannerCorner, styles.cornerTR]} />
              <View style={[styles.scannerCorner, styles.cornerBL]} />
              <View style={[styles.scannerCorner, styles.cornerBR]} />
            </View>
            <Text style={styles.scanHint}>Align QR code within the frame</Text>
          </View>
          {scanned && (
            <View style={styles.overlay}>
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <TouchableOpacity
                  style={styles.rescanButton}
                  onPress={() => setScanned(false)}
                >
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.rescanText}>Tap to scan again</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── NEARBY STORES DIRECTORY ──
  if (showingStores) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={{ flex: 1, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setShowingStores(false)} style={{ marginRight: 15 }}>
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A' }}>Partner Stores</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity onPress={requestNearbyStores} style={{ flex: 1, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#6366F1', fontWeight: 'bold' }}>Find Nearby</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fetchAllStores} style={{ flex: 1, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#64748B', fontWeight: 'bold' }}>View All</Text>
            </TouchableOpacity>
          </View>

          {directoryLoading ? (
            <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 50 }} />
          ) : storesList.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 50 }}>No stores found.</Text>
          ) : (
            <FlatList
              data={storesList}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 15 }}>
                     {item.imageUrl ? (
                       <Image source={{ uri: item.imageUrl }} style={{ width: 70, height: 70, borderRadius: 12 }} />
                     ) : (
                       <View style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="storefront" size={28} color="#94A3B8" />
                       </View>
                     )}
                     <View style={{ flex: 1 }}>
                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                         <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                           <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#6366F1', textTransform: 'uppercase' }}>{item.category || 'General'}</Text>
                         </View>
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                           <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.isOpen ? '#10B981' : '#EF4444' }} />
                           <Text style={{ fontSize: 11, fontWeight: '700', color: item.isOpen ? '#10B981' : '#EF4444' }}>{item.isOpen ? 'OPEN' : 'CLOSED'}</Text>
                         </View>
                       </View>

                       <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 }}>{item.name}</Text>
                       
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                         <Ionicons name="location" size={14} color="#64748B" />
                         <Text style={{ fontSize: 13, color: '#64748B', flex: 1 }} numberOfLines={1}>{item.address || 'Address not provided'}</Text>
                       </View>

                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                         <Ionicons name="time-outline" size={14} color="#94A3B8" />
                         <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                           {item.operatingHours?.mon_fri || '9 AM - 10 PM'}
                         </Text>
                       </View>
                     </View>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── STORE ENTERED ──
  if (storeEntered) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.enteredContent}>
          <View style={styles.successIconBox}>
            <Ionicons name="checkmark-circle" size={56} color="#10B981" />
          </View>
          <Text style={styles.enteredTitle}>You're Inside!</Text>
          <Text style={styles.enteredStore}>{storeName}</Text>
          <Text style={styles.enteredHint}>
            Start scanning products to add them to your cart
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('ProductScan')}
            activeOpacity={0.8}
          >
            <Ionicons name="scan" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Start Scanning Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="cart-outline" size={20} color="#6366F1" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>View Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ paddingVertical: 15, borderRadius: 14, backgroundColor: 'transparent', width: '100%', alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            onPress={requestNearbyStores}
          >
            <Ionicons name="map-outline" size={18} color="#94A3B8" />
            <Text style={{ color: '#64748B', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' }}>Browse Nearby Stores</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── HOME (Default — Scan Entry QR button) ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.homeContent}>
        {/* Top Section */}
        <View style={styles.homeTop}>
          <View style={styles.homeBadge}>
            <Ionicons name="qr-code" size={18} color="#6366F1" />
            <Text style={styles.homeBadgeText}>SmartQR Checkout</Text>
          </View>
          <Text style={styles.homeTitle}>Ready to Shop?</Text>
          <Text style={styles.homeDesc}>
            Scan the store's entry QR code to begin your self-checkout experience
          </Text>
        </View>

        {/* Illustration Card */}
        <View style={styles.illustrationCard}>
          <View style={styles.illustrationIconWrap}>
            <View style={styles.illustrationBg}>
              <Ionicons name="storefront-outline" size={48} color="#6366F1" />
            </View>
          </View>
          <View style={styles.stepsContainer}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <Text style={styles.stepText}>Scan the entry QR at the store</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={styles.stepText}>Add products by scanning their QR</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <Text style={styles.stepText}>Pay online & get your exit QR code</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12, marginBottom: 10 }}>
          <TouchableOpacity
            style={styles.scanEntryBtn}
            onPress={() => {
              setScanned(false);
              setShowCamera(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="scan-outline" size={24} color="#FFFFFF" />
            <Text style={styles.scanEntryBtnText}>Scan Entry QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ paddingVertical: 16, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            onPress={requestNearbyStores}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={20} color="#6366F1" />
            <Text style={{ color: '#6366F1', fontSize: 16, fontWeight: '700' }}>Browse Nearby Stores</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permissionText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
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
    lineHeight: 20,
  },

  // ── HOME DEFAULT ──
  homeContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  homeTop: {
    alignItems: 'center',
    marginTop: 16,
  },
  homeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  homeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  homeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  homeDesc: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  // Illustration Card
  illustrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginVertical: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  illustrationIconWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  illustrationBg: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsContainer: {
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },

  // Scan Entry Button
  scanEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 10,
  },
  scanEntryBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  // ── CAMERA ──
  cameraFullContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  cameraHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraViewContainer: {
    flex: 1,
    width: '100%',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.9)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rescanText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── STORE ENTERED ──
  enteredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successIconBox: {
    marginBottom: 16,
  },
  enteredTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  enteredStore: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 12,
  },
  enteredHint: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    marginBottom: 14,
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
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secondaryBtnText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;