import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';

const HomeScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeEntered, setStoreEntered] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      const storeId = data.trim();
      const token = await AsyncStorage.getItem('token');
      const customerId = await AsyncStorage.getItem('customerId');

      // Call entry endpoint
      const response = await axios.post(
        `${API_BASE_URL}/api/orders/entry`,
        { storeId },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );

      // Get store details
      const storeRes = await axios.get(
        `${API_BASE_URL}/api/stores/${storeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await AsyncStorage.setItem('currentOrderId', response.data.orderId);
      await AsyncStorage.setItem('currentStoreId', storeId);
      setStoreName(storeRes.data.name);
      setStoreEntered(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err.response?.data?.error || err.message, [
        { text: 'Retry', onPress: () => setScanned(false) }
      ]);
    }
  };

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>Camera permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {storeEntered ? (
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>✓ Welcome to {storeName}</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('ProductScan')}>
            <Text style={styles.buttonText}>Start Scanning Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Scan Store Entry QR</Text>
          <View style={styles.cameraContainer}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barCodeScannerSettings={{ barCodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            {scanned && <View style={styles.overlay}>{loading && <ActivityIndicator size="large" color="#fff" />}</View>}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  cameraContainer: { flex: 1, margin: 15, borderRadius: 10, overflow: 'hidden' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 30, marginBottom: 20, color: '#333' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#28a745', marginBottom: 30 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', width: '100%' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
});

export default HomeScreen;
