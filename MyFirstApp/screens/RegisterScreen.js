import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import API_BASE_URL from '../config';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Validation Error', 'Please enter a password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/customers/register`,
        { name, email, password, phone },
        { timeout: 10000 }
      );
      setLoading(false);
      Alert.alert('Success', 'Registration successful! Please login.', [
        {
          text: 'OK',
          onPress: () => {
            setName('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setPhone('');
            navigation.navigate('Login');
          },
        },
      ]);
    } catch (err) {
      setLoading(false);
      console.log('Registration Error:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || err.message || 'Registration failed';
      Alert.alert('Registration Failed', errorMessage);
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
            <Ionicons name="person-add" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.bannerTitle}>Join SmartQR</Text>
          <Text style={styles.bannerSubtitle}>Create your account in seconds</Text>
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
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#CBD5E1"
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>
          </View>

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
            <Text style={styles.inputLabel}>Phone</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor="#CBD5E1"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
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
                placeholder="Min. 6 characters"
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

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="#CBD5E1"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={secureConfirm}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setSecureConfirm(!secureConfirm)} style={styles.eyeBtn}>
                <Ionicons
                  name={secureConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.ghostBtnText}>Already have an account? Sign In</Text>
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
  banner: {
    backgroundColor: '#6366F1',
    paddingTop: 56,
    paddingBottom: 32,
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
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '400',
  },
  formSection: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 30,
  },
  inputGroup: {
    marginBottom: 14,
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
  primaryBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
    marginVertical: 16,
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
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen;