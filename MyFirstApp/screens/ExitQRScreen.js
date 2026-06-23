import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';

const COUNTDOWN_SECONDS = 10 * 60; // 10 minutes

const ExitQRScreen = ({ navigation, route }) => {
  const { orderId, storeId, totalAmount, transactionId } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [exitQR, setExitQR] = useState(null);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const [countdownActive, setCountdownActive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const timerRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Countdown logic
  useEffect(() => {
    if (countdownActive && timeLeft > 0 && !showSuccess) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setCountdownActive(false);
            setExitQR(null);
            Alert.alert('⏰ Time Expired', 'Your exit QR has expired. Please contact store staff for assistance.', [
              { text: 'OK', onPress: () => handleGoHome() },
            ]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timerRef.current);
    }
  }, [countdownActive, showSuccess]);

  // Polling logic to check if shopkeeper validated the QR
  useEffect(() => {
    if (countdownActive && exitQR && !showSuccess) {
      pollingRef.current = setInterval(async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) return;

          const response = await axios.get(
            `${API_BASE_URL}/api/orders/status/${orderId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.data.exitTime) {
            clearInterval(pollingRef.current);
            clearInterval(timerRef.current);
            setCountdownActive(false);
            setExitQR(null);
            setShowSuccess(true);

            await AsyncStorage.removeItem('currentOrderId');
            await AsyncStorage.removeItem('currentStoreId');
            await AsyncStorage.removeItem('currentStore');

            setTimeout(() => {
              navigation.replace('Main');
            }, 12000);
          }
        } catch (error) {
          console.error('Polling error:', error.response?.data || error.message);
        }
      }, 3000);

      return () => clearInterval(pollingRef.current);
    }
  }, [countdownActive, exitQR, showSuccess, orderId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLoadExitQR = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Error', 'Authentication failed');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/orders/generate-exit-qr`,
        { storeId },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }
      );

      const { exitQR: qrData } = response.data;

      setExitQR(qrData);
      setTimeLeft(COUNTDOWN_SECONDS);
      setCountdownActive(true);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('Exit QR error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to generate exit QR';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleGoHome = () => {
    navigation.replace('Main');
  };

  // ── THANK YOU SCREEN ──
  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.thankYouScreen}>
          {/* Top Decor */}
          <View style={styles.thankYouDecorTop} />

          {/* Success Icon */}
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-done" size={48} color="#FFFFFF" />
          </View>

          <Text style={styles.thankYouTitle}>Thank You!</Text>
          <Text style={styles.thankYouSubtitle}>Your visit has been verified</Text>

          {totalAmount > 0 && (
            <View style={styles.thankYouCard}>
              <View style={styles.thankYouRow}>
                <Ionicons name="receipt-outline" size={18} color="#64748B" />
                <Text style={styles.thankYouLabel}>Amount Paid</Text>
              </View>
              <Text style={styles.thankYouAmount}>₹{totalAmount.toFixed(2)}</Text>
            </View>
          )}

          <Text style={styles.thankYouVisit}>We hope to see you again soon!</Text>

          <View style={styles.thankYouDivider} />

          <Text style={styles.redirectText}>Redirecting to home in 12 seconds…</Text>

          <TouchableOpacity style={styles.goHomeBtn} onPress={handleGoHome} activeOpacity={0.8}>
            <Ionicons name="home-outline" size={20} color="#FFFFFF" />
            <Text style={styles.goHomeBtnText}>Go to Home Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── EXIT QR SCREEN ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Exit QR Code</Text>
      </View>

      {/* Payment Info Card */}
      <View style={styles.paymentCard}>
        {totalAmount > 0 ? (
          <>
            <View style={styles.paymentIconBox}>
              <Ionicons name="checkmark-circle" size={32} color="#10B981" />
            </View>
            <Text style={styles.paymentStatus}>Payment Successful</Text>
            <Text style={styles.paymentAmount}>₹{totalAmount?.toFixed(2) || '0.00'}</Text>
            {transactionId && (
              <View style={styles.txnBadge}>
                <Ionicons name="receipt-outline" size={14} color="#64748B" />
                <Text style={styles.txnText}>TXN: {transactionId.slice(-12)}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.paymentIconBoxEmpty}>
              <Ionicons name="bag-handle-outline" size={28} color="#F59E0B" />
            </View>
            <Text style={styles.paymentStatusEmpty}>Empty Cart Exit</Text>
            <Text style={styles.txnTextSimple}>No purchase made</Text>
          </>
        )}
      </View>

      {/* QR Section */}
      <View style={styles.qrSection}>
        {!exitQR && !loading && (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#6366F1" />
              <Text style={styles.infoText}>
                Generate your exit QR code and show it at the exit gate to leave the store.
              </Text>
            </View>
            <TouchableOpacity style={styles.loadQRBtn} onPress={handleLoadExitQR} activeOpacity={0.8}>
              <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
              <Text style={styles.loadQRBtnText}>Generate Exit QR</Text>
            </TouchableOpacity>
          </>
        )}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingLabel}>Generating Exit QR…</Text>
          </View>
        )}

        {exitQR && !loading && (
          <View style={styles.qrContainer}>
            <View style={styles.qrImageWrapper}>
              <Image source={{ uri: exitQR }} style={styles.qrImage} resizeMode="contain" />
            </View>

            <View
              style={[
                styles.timerContainer,
                timeLeft <= 60 && styles.timerWarning,
              ]}
            >
              <Text style={styles.timerLabel}>QR expires in</Text>
              <Text
                style={[
                  styles.timerText,
                  timeLeft <= 60 && styles.timerTextWarning,
                ]}
              >
                {formatTime(timeLeft)}
              </Text>
            </View>

            <Text style={styles.showHint}>Show this QR code at the exit gate</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },

  // Payment Card
  paymentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  paymentIconBox: {
    marginBottom: 10,
  },
  paymentIconBoxEmpty: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  paymentStatus: {
    fontSize: 17,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  paymentStatusEmpty: {
    fontSize: 17,
    fontWeight: '700',
    color: '#D97706',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  txnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  txnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  txnTextSimple: {
    fontSize: 14,
    color: '#94A3B8',
  },

  // QR Section
  qrSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#4338CA',
    lineHeight: 20,
    fontWeight: '500',
  },
  loadQRBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loadQRBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  loadingBox: {
    alignItems: 'center',
  },
  loadingLabel: {
    fontSize: 15,
    color: '#475569',
    marginTop: 14,
    fontWeight: '500',
  },

  // QR Display
  qrContainer: {
    alignItems: 'center',
  },
  qrImageWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrImage: {
    width: 240,
    height: 240,
    borderRadius: 8,
  },
  timerContainer: {
    marginTop: 18,
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  timerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  timerLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '500',
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
    fontVariant: ['tabular-nums'],
  },
  timerTextWarning: {
    color: '#D97706',
  },
  showHint: {
    marginTop: 14,
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // ── THANK YOU ──
  thankYouScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    position: 'relative',
  },
  thankYouDecorTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: '#F0FDF4',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  thankYouTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  thankYouSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
  },
  thankYouCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thankYouRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  thankYouLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  thankYouAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
  },
  thankYouVisit: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
    marginBottom: 24,
  },
  thankYouDivider: {
    width: 60,
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 16,
  },
  redirectText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 24,
    fontWeight: '500',
  },
  goHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ExitQRScreen;
