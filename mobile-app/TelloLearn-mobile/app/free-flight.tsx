import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { XCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react-native';
import Joystick from '@/components/modules/Joystick';
import axios from 'axios';

export default function FreeFlightScreen() {
  const router = useRouter();
  const theme = Colors.dark;
  
  // We use refs for joystick values so our interval loop always reads the latest numbers!
  const leftJoy = useRef({ x: 0, y: 0 });  // Yaw, Altitude
  const rightJoy = useRef({ x: 0, y: 0 }); // Roll, Pitch

  const [isConnected, setIsConnected] = useState(true);

  // THE RC LOOP: Sends commands to the server 10 times a second
  useEffect(() => {
    const serverIp = process.env.EXPO_PUBLIC_API_URL;
    
    const rcInterval = setInterval(async () => {
      // Only send if joysticks are actively being moved (saves battery and network)
      if (leftJoy.current.x !== 0 || leftJoy.current.y !== 0 || rightJoy.current.x !== 0 || rightJoy.current.y !== 0) {
        try {
          await axios.post(`${serverIp}/api/execute/rc`, {
            left_right: rightJoy.current.x,    // Roll
            forward_backward: rightJoy.current.y, // Pitch
            up_down: leftJoy.current.y,        // Altitude
            yaw: leftJoy.current.x             // Rotation
          });
        } catch (e) {
          console.log("RC Data dropped");
        }
      }
    }, 100); // 100ms loop

    return () => clearInterval(rcInterval); // Cleanup on exit
  }, []);

  const sendSingleCommand = async (command: string) => {
    try {
      const serverIp = process.env.EXPO_PUBLIC_API_URL;
      await axios.post(`${serverIp}/api/execute/sequence`, { commands: [command] });
    } catch (e) {
      Alert.alert("Error", "Command failed to send.");
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <XCircle color="white" size={32} />
        </TouchableOpacity>
        <Text style={styles.title}>FREE FLIGHT DECK</Text>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
      </View>

      {/* FLIGHT CONTROLS */}
      <View style={styles.flightArea}>
        
        {/* LEFT JOYSTICK: Altitude & Yaw */}
        <View style={styles.joyWrapper}>
          <Text style={styles.joyLabel}>ALTITUDE / YAW</Text>
          <Joystick onValueChange={(val) => leftJoy.current = val} />
        </View>

        {/* CENTER BUTTONS: Takeoff / Land */}
        <View style={styles.centerPanel}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => sendSingleCommand('takeoff')}>
            <ArrowUpCircle color="#10b981" size={40} />
            <Text style={styles.actionText}>TAKEOFF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => sendSingleCommand('land')}>
            <ArrowDownCircle color="#ef4444" size={40} />
            <Text style={styles.actionText}>LAND</Text>
          </TouchableOpacity>
        </View>

        {/* RIGHT JOYSTICK: Pitch & Roll */}
        <View style={styles.joyWrapper}>
          <Text style={styles.joyLabel}>PITCH / ROLL</Text>
          <Joystick onValueChange={(val) => rightJoy.current = val} />
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: 'rgba(0,0,0,0.5)' },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  flightArea: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40 },
  joyWrapper: { alignItems: 'center', gap: 20 },
  joyLabel: { color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', letterSpacing: 1 },
  centerPanel: { justifyContent: 'center', alignItems: 'center', gap: 30 },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionText: { color: 'white', fontWeight: 'bold' }
});