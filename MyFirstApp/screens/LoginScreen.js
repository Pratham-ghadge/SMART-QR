import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);

  useEffect(() => {
    checkLoggedIn();
  }, []);

  const checkLoggedIn = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      setLoading(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/customers/verify-token`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      if (response.data.customer) {
        await AsyncStorage.setItem('customerId', response.data.customer.id);
        await AsyncStorage.setItem('customerName', response.data.customer.name);
        await AsyncStorage.setItem('customerEmail', response.data.customer.email);
        setLoading(false);
        navigation.replace('Main');
      }
    } catch (err) {
      console.log('Auto-login failed:', err.response?.data?.error || err.message);
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('customerId');
      await AsyncStorage.removeItem('customerName');
      await AsyncStorage.removeItem('customerEmail');
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/customers/login`,
        { email, password },
        { timeout: 10000 }
      );

      if (response.data.token && response.data.customer) {
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('customerId', response.data.customer.id);
        await AsyncStorage.setItem('customerName', response.data.customer.name);
        await AsyncStorage.setItem('customerEmail', response.data.customer.email);
        setLoading(false);
        navigation.replace('Main');
      } else {
        setLoading(false);
        setError('Invalid response from server');
      }
    } catch (err) {
      setLoading(false);
      console.log('Login Error:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || err.message || 'Login failed';
      setError(errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Top Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerDecorCircle1} />
        <View style={styles.bannerDecorCircle2} />
        <View style={styles.bannerContent}>
          <View style={styles.logoBox}>
            <Ionicons name="qr-code" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.bannerTitle}>SmartQR</Text>
          <Text style={styles.bannerSubtitle}>Self-Checkout Made Simple</Text>
        </View>
      </View>

      {/* Form Section */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formSection}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formDesc}>Sign in to continue shopping</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#CBD5E1"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#CBD5E1"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secureEntry}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)} style={styles.eyeBtn}>
                <Ionicons
                  name={secureEntry ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.ghostBtnText}>Create New Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Banner
  banner: {
    backgroundColor: '#6366F1',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerDecorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -60,
  },
  bannerDecorCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -40,
    left: -40,
  },
  bannerContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bannerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  bannerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '400',
  },
  // Form
  formSection: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 30,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  formDesc: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
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
  btnDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  ghostBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  ghostBtnText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginScreen;