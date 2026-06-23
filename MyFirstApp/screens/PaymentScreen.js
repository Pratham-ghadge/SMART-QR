import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';

const PaymentScreen = ({ navigation, route }) => {
  const { cart, totalAmount, orderId, storeId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [razorpayData, setRazorpayData] = useState(null);
  const [token, setToken] = useState(null);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const webViewRef = useRef(null);

  React.useEffect(() => {
    initPayment();
  }, []);

  const initPayment = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('token');
      setToken(savedToken);

      if (!savedToken) {
        Alert.alert('Error', 'Authentication failed');
        navigation.goBack();
        return;
      }

      if (!totalAmount || totalAmount <= 0) {
        Alert.alert('Error', 'Invalid amount');
        navigation.goBack();
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/payment/create-payment-intent`,
        {
          totalAmount: totalAmount,
          storeId: storeId,
        },
        {
          headers: { Authorization: `Bearer ${savedToken}` },
          timeout: 15000,
        }
      );

      const { orderId: razorpayOrderId, amount, currency, key_id } = response.data;

      if (!razorpayOrderId || !amount || !currency || !key_id) {
        throw new Error('Missing required payment data from server');
      }

      const customerName = (await AsyncStorage.getItem('customerName')) || '';
      const customerEmail = (await AsyncStorage.getItem('customerEmail')) || '';

      setRazorpayData({
        key_id,
        amount,
        currency,
        razorpayOrderId,
        customerName,
        customerEmail,
      });

      setLoading(false);
      setPaymentStarted(true);
    } catch (error) {
      setLoading(false);
      console.error('Payment init error:', error);
      const errorMsg =
        error.response?.data?.error || error.message || 'Failed to initialize payment';
      Alert.alert('Payment Error', errorMsg, [
        { text: 'Go Back', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const getCheckoutHTML = () => {
    if (!razorpayData) return '';

    const { key_id, amount, currency, razorpayOrderId, customerName, customerEmail } =
      razorpayData;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Razorpay Payment</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .loading-container {
            text-align: center;
            padding: 20px;
          }
          .loading-text {
            font-size: 18px;
            color: #333;
            margin-top: 15px;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #6366F1;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loading-container">
          <div class="spinner"></div>
          <p class="loading-text">Opening Razorpay...</p>
        </div>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          var options = {
            key: '${key_id}',
            amount: ${amount},
            currency: '${currency}',
            name: 'Smart QR Checkout',
            description: 'Payment for your order',
            order_id: '${razorpayOrderId}',
            prefill: {
              name: '${customerName}',
              email: '${customerEmail}'
            },
            theme: {
              color: '#6366F1'
            },
            handler: function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                data: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                }
              }));
            },
            modal: {
              ondismiss: function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_CANCELLED'
                }));
              },
              escape: false,
              backdropclose: false
            }
          };

          try {
            var rzp = new Razorpay(options);
            rzp.on('payment.failed', function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_FAILED',
                data: {
                  code: response.error.code,
                  description: response.error.description,
                  reason: response.error.reason
                }
              }));
            });
            rzp.open();
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_ERROR',
              data: { message: e.message }
            }));
          }
        </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'PAYMENT_SUCCESS') {
        setLoading(true);
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = message.data;

        const confirmResponse = await axios.post(
          `${API_BASE_URL}/api/payment/confirm`,
          {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            storeId: storeId,
            amount: totalAmount,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
          }
        );

        const {
          orderId: paymentOrderId,
          transactionId,
          storeId: paymentStoreId,
        } = confirmResponse.data;

        setLoading(false);
        Alert.alert('✅ Payment Successful', `Transaction ID: ${transactionId}`, [
          {
            text: 'Continue',
            onPress: () => {
              navigation.replace('ExitQR', {
                orderId: paymentOrderId,
                storeId: paymentStoreId || storeId,
                totalAmount: totalAmount,
                transactionId: transactionId,
              });
            },
          },
        ]);
      } else if (message.type === 'PAYMENT_CANCELLED') {
        Alert.alert('Payment Cancelled', 'You cancelled the payment.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (message.type === 'PAYMENT_FAILED') {
        const errorDesc = message.data?.description || 'Payment failed';
        Alert.alert('Payment Failed', errorDesc, [
          { text: 'Retry', onPress: () => initPayment() },
          { text: 'Go Back', onPress: () => navigation.goBack() },
        ]);
      } else if (message.type === 'PAYMENT_ERROR') {
        Alert.alert('Error', message.data?.message || 'Payment error occurred', [
          { text: 'Go Back', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('WebView message error:', error);
      setLoading(false);
      Alert.alert('Error', 'Something went wrong processing the payment', [
        { text: 'Go Back', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loading && !paymentStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Initializing Payment…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && paymentStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Confirming Payment…</Text>
          <Text style={styles.subText}>Please wait, do not close the app</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!razorpayData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconBox}>
            <Ionicons name="warning-outline" size={36} color="#EF4444" />
          </View>
          <Text style={styles.errorText}>Failed to load payment</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initPayment}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={22} color="#EF4444" />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>₹{totalAmount.toFixed(2)}</Text>
      </View>
      <WebView
        ref={webViewRef}
        source={{ html: getCheckoutHTML() }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.webviewLoading}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Loading Razorpay…</Text>
          </View>
        )}
        style={styles.webview}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          Alert.alert(
            'Error',
            'Failed to load payment page. Please check your internet connection.',
            [{ text: 'Go Back', onPress: () => navigation.goBack() }]
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  backText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 17,
    color: '#0F172A',
    marginTop: 16,
    fontWeight: '600',
  },
  subText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 24,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default PaymentScreen;
