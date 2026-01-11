import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router'; 
import { StatusBar } from 'expo-status-bar';

// 1. CONFIGURATION
const API_URL = 'http://10.167.105.239:8000/api'; 

// THEME COLORS (You can replace these with import { COLORS } from '../constants/theme')
const COLORS = {
  primary: '#007AFF',    // Drone Blue
  background: '#F2F2F7', // Light Gray
  card: '#FFFFFF',
  text: '#1C1C1E',
  subtext: '#8E8E93',
  border: '#E5E5EA',
  error: '#FF3B30',
};

export default function LoginScreen() {
  const router = useRouter(); 
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Missing Info', 'Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const fullUrl = `${API_URL}/auth/login`;
      console.log(`[LOGIN] Sending credentials to ${fullUrl}...`);

      const response = await axios.post(fullUrl, {
        username: username, 
        password: password,
      });

      console.log('[LOGIN] Success:', response.data);
      
      const { token, status, modules, id } = response.data;

      if (status === 'success') {
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_id', id);
        await AsyncStorage.setItem('user_username', username);
        await AsyncStorage.setItem('user_modules', JSON.stringify(modules));

        router.replace('/dashboard'); 
      } else {
        Alert.alert('Login Failed', 'Server returned an error.');
      }

    } catch (error: any) {
      console.error('[LOGIN ERROR]', error);
      if (error.response) {
        Alert.alert('Login Failed', error.response.data.detail || 'Invalid credentials');
      } else if (error.request) {
        Alert.alert('Connection Error', 'Could not reach server. Is the backend running?');
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>TelloLearn</Text>
        <Text style={styles.subtitle}>Drone Pilot Login</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. PilotAhmad" 
            placeholderTextColor="#C7C7CC"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#C7C7CC"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? Ask your instructor.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 24, 
    backgroundColor: COLORS.background 
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: COLORS.primary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.subtext,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5, // Android shadow
  },
  inputGroup: { 
    marginBottom: 20 
  },
  label: { 
    marginBottom: 8, 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: { 
    backgroundColor: '#F9F9F9', 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    padding: 16, 
    borderRadius: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  button: { 
    marginTop: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.subtext,
    fontSize: 13,
  }
});