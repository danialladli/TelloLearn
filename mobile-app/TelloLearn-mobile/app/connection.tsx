import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Wifi, Server } from 'lucide-react-native';

// Reusable Step Component
type StepProps = {
  number: string;
  title: string;
  desc: string;
  theme: any;
};

const Step: React.FC<StepProps> = ({ number, title, desc, theme }) => (
  <View style={[styles.stepContainer, { backgroundColor: theme.card }]}>
    <View style={[styles.stepNumber, { backgroundColor: theme.tint }]}>
      <Text style={styles.stepText}>{number}</Text>
    </View>
    <View style={{flex: 1}}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>{desc}</Text>
    </View>
  </View>
);

export default function ConnectionScreen() {
  const router = useRouter();
  const theme = Colors.dark;
  
  const [ipAddress, setIpAddress] = useState('192.168.1.X'); 
  const [isScanning, setIsScanning] = useState(false);

  // Load saved IP on startup
  useEffect(() => {
    const loadSavedIp = async () => {
      const savedIp = await AsyncStorage.getItem('serverIp');
      if (savedIp) {
        setIpAddress(savedIp);
      }
    };
    loadSavedIp();
  }, []);

  const handleScan = async () => {
    // Basic IP validation
    if (!ipAddress || ipAddress.endsWith('.X') || ipAddress.length < 7) {
      Alert.alert("Invalid IP", "Please enter your PC's actual local IPv4 address (e.g., 192.168.1.5)");
      return;
    }

    setIsScanning(true);
    const serverUrl = `http://${ipAddress}:8000`; 

    try {
      console.log(`Pinging Ground Server at ${serverUrl}...`);

      // CONNECTION LOGIC:
      // We assume your Python server root "/" returns a 200 OK
      await axios.get(`${serverUrl}/`, { timeout: 3000 });
      
      // SUCCESS:
      // 1. Save IP for future use
      await AsyncStorage.setItem('serverIp', ipAddress);

      // 2. Alert user
      Alert.alert("Connected!", "Ground Server found. Entering Flight Deck.");
      
      // 3. Move to Step 4 (Dashboard)
      router.replace('./dashboard');

    } catch (error) {
      console.log("Connection Error:", error);
      Alert.alert(
        "Connection Failed", 
        `Could not reach Ground Server at ${ipAddress}.\n\nTroubleshooting:\n1. Is 'python main.py' running?\n2. Did you use '--host 0.0.0.0'?\n3. Are Phone and PC on the same Wi-Fi?`
      );
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Header */}
      <View style={[styles.header, { borderColor: theme.border }]}>
        <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
           <Wifi size={24} color={theme.text} />
           <Text style={[styles.headerTitle, { color: theme.text }]}>Ground Server Link</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={[styles.dot, { backgroundColor: isScanning ? 'orange' : '#ef4444' }]} />
          <Text style={styles.statusText}>{isScanning ? "Scanning Network..." : "Disconnected"}</Text>
        </View>
      </View>

      <View style={styles.mainLayout}>
        {/* Left Column: Instructions */}
        <ScrollView style={styles.scrollArea}>
          <Text style={[styles.instruction, { color: theme.textSecondary }]}>
            Your phone needs to talk to the Python script running on your PC.
          </Text>
          <View style={styles.grid}>
            <Step number="1" title="Find PC IP" theme={theme} desc="Open CMD on PC, type 'ipconfig', look for IPv4 Address." />
            <Step number="2" title="Start Server" theme={theme} desc="Run 'uvicorn main:app --host 0.0.0.0' on PC." />
          </View>
        </ScrollView>

        {/* Right Column: Connection Form */}
        <View style={[styles.connectPanel, { borderLeftColor: theme.border }]}>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Configuration</Text>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>PC IP Address</Text>
          <TextInput 
            style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]}
            value={ipAddress}
            onChangeText={setIpAddress}
            keyboardType="numeric"
            placeholder="192.168.1.5"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <TouchableOpacity 
            style={[styles.connectBtn, { backgroundColor: isScanning ? theme.border : theme.success }]} 
            onPress={handleScan}
            disabled={isScanning}
          >
             {isScanning ? (
                <ActivityIndicator color="#fff" />
             ) : (
                <View style={{flexDirection:'row', gap: 8, alignItems:'center'}}>
                    <Server size={20} color="white" />
                    <Text style={styles.btnText}>ESTABLISH DATALINK</Text>
                </View>
             )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
  
  mainLayout: { flex: 1, flexDirection: 'row' },
  scrollArea: { flex: 0.6, padding: 20 },
  instruction: { fontSize: 16, marginBottom: 20 },
  grid: { gap: 10 },
  stepContainer: { padding: 15, borderRadius: 12, flexDirection: 'row', marginRight: 15, marginBottom: 10, alignItems: 'center', gap: 12 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: 'white', fontWeight: 'bold' },
  stepTitle: { fontWeight: 'bold', fontSize: 15 },
  stepDesc: { fontSize: 13 },

  connectPanel: { flex: 0.4, padding: 30, justifyContent: 'center', borderLeftWidth: 1 },
  panelTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { marginBottom: 8, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 8, padding: 15, marginBottom: 20, fontSize: 18, fontFamily: 'monospace' },
  connectBtn: { padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
});