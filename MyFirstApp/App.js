import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import ProductScanScreen from './screens/ProductScanScreen';
import CartScreen from './screens/CartScreen';
import PaymentScreen from './screens/PaymentScreen';
import ExitQRScreen from './screens/ExitQRScreen';
import ProfileScreen from './screens/ProfileScreen';

const AuthStack = createStackNavigator();
const ScanStack = createStackNavigator();
const Tab = createBottomTabNavigator();

const ScanStackScreen = () => (
  <ScanStack.Navigator screenOptions={{ headerShown: false }}>
    <ScanStack.Screen name="StoreScan" component={HomeScreen} />
    <ScanStack.Screen name="ProductScan" component={ProductScanScreen} />
  </ScanStack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Cart') {
          iconName = focused ? 'cart' : 'cart-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        }
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#6366F1',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingBottom: 6,
        paddingTop: 6,
        height: 60,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
    })}
  >
    <Tab.Screen name="Home" component={ScanStackScreen} />
    <Tab.Screen name="Cart" component={CartScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export default function App() {
  return (
    <NavigationContainer>
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="Main" component={MainTabs} />
        <AuthStack.Screen name="Payment" component={PaymentScreen} />
        <AuthStack.Screen name="ExitQR" component={ExitQRScreen} />
      </AuthStack.Navigator>
    </NavigationContainer>
  );
}
