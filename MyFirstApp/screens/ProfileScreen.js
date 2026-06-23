import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../config';

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setLoading(false);
      navigation.replace('Login');
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setUser(res.data);
      setForm({
        name: res.data.name || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        password: '',
      });
    } catch (err) {
      console.log('Profile load error:', err.response?.data || err.message);
      Alert.alert('Error', 'Unable to load profile. Please login again.', [
        {
          text: 'OK',
          onPress: async () => {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            navigation.replace('Login');
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      Alert.alert('Validation', 'Name and email are required');
      return;
    }
    setSaving(true);
    const token = await AsyncStorage.getItem('token');
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/customers/profile`,
        {
          name: form.name,
          phone: form.phone,
          password: form.password ? form.password : undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );
      setUser(res.data);
      await AsyncStorage.setItem('user', JSON.stringify(res.data));
      setForm((prev) => ({ ...prev, password: '' }));
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      console.log('Profile update error:', err.response?.data || err.message);
      const message = err.response?.data?.error || 'Unable to update profile';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const token = await AsyncStorage.getItem('token');
    try {
      await axios.post(`${API_BASE_URL}/api/customers/logout`, null, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
    } catch (err) {
      // ignore
    }
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('currentStoreId');
    await AsyncStorage.removeItem('currentOrderId');
    await AsyncStorage.removeItem('currentStore');
    await AsyncStorage.removeItem('cart');
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar + Name */}
          <View style={styles.profileTop}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarLetter}>
                {form.name ? form.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.profileName}>{form.name || 'Customer'}</Text>
            <Text style={styles.profileEmail}>{form.email}</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor="#CBD5E1"
                  value={form.name}
                  onChangeText={(val) => setForm((prev) => ({ ...prev, name: val }))}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={[styles.inputWrapper, styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: '#94A3B8' }]}
                  placeholder="Email"
                  value={form.email}
                  editable={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  placeholderTextColor="#CBD5E1"
                  value={form.phone}
                  onChangeText={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Leave blank to keep current"
                  placeholderTextColor="#CBD5E1"
                  value={form.password}
                  onChangeText={(val) => setForm((prev) => ({ ...prev, password: val }))}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 30,
  },

  // Profile Top
  profileTop: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748B',
  },

  // Form Card
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  inputGroup: {
    marginBottom: 16,
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
  inputDisabled: {
    backgroundColor: '#F1F5F9',
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

  // Buttons
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
