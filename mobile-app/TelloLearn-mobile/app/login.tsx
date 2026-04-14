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
  ScrollView // <-- We need this to make it scrollable!
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router'; 
import { StatusBar } from 'expo-status-bar';

// THEME COLORS
const COLORS = {
  primary: '#007AFF',    
  background: '#F2F2F7', 
  card: '#FFFFFF',
  text: '#1C1C1E',
  subtext: '#8E8E93',
  border: '#E5E5EA',
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
      // Using the dynamic IP logic we set up previously!
      const serverIp = await AsyncStorage.getItem('serverIp');
      if (!serverIp) {
         Alert.alert("Error", "No server IP found. Please reconnect.");
         router.replace('./connection');
         return;
      }

      const fullUrl = `http://${serverIp}:8000/api/auth/login`;
      console.log(`[LOGIN] Sending credentials to ${fullUrl}...`);

      const response = await axios.post(fullUrl, {
        username: username, 
        password: password,
      });

      const { token, status, modules, id, avatar } = response.data;

      if (status === 'success') {
        await AsyncStorage.setItem('user_token', token);
        await AsyncStorage.setItem('user_id', id);
        await AsyncStorage.setItem('user_username', username);
        // Save avatar if your backend sends it during login too!
        if (avatar) await AsyncStorage.setItem('user_avatar', avatar); 

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
      
      {/* Wrapping everything in a ScrollView! 
        flexGrow: 1 ensures it centers the content if the screen is large enough,
        but allows scrolling if the screen is too small.
      */}
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          <Text style={styles.footerText}>Don't have an account? Sign Up on our Web App now!</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40, // Adds breathing room at the top/bottom for scrolling
  },
  header: {
    alignItems: 'center',
    marginBottom: 30, // Reduced from 40 to tighten the layout
  },
  title: { 
    fontSize: 28, // Reduced from 32 so it doesn't break onto two lines easily
    fontWeight: '800', 
    color: COLORS.primary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15, // Slightly smaller
    color: COLORS.subtext,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16, // Slightly sharper corners look more modern
    padding: 20, // Reduced from 24
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3, 
  },
  inputGroup: { 
    marginBottom: 16 // Tighter spacing between inputs
  },
  label: { 
    marginBottom: 6, 
    fontSize: 12, // Reduced from 14 for a cleaner look
    fontWeight: '600', 
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: { 
    backgroundColor: '#F9F9F9', 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    paddingHorizontal: 14, 
    paddingVertical: 12, // Reduced height significantly!
    borderRadius: 10, // Sleeker input boxes
    fontSize: 15,
    color: COLORS.text,
  },
  button: { 
    marginTop: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 14, // Reduced height significantly!
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: 25,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.subtext,
    fontSize: 13,
  }
});