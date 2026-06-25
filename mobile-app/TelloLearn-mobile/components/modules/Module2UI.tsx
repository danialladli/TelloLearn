import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { XCircle, Play, Square, AlertOctagon, Target } from 'lucide-react-native';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { checkDroneConnected } from '@/utils/droneCheck';
import { useApiUrl } from '@/utils/apiConfig';

export default function Module2({ moduleData }: { moduleData: any }) {
  const { apiUrl: API_URL } = useApiUrl();
  const router = useRouter();
  
  const [missionActive, setMissionActive] = useState(false);
  const [padDetected, setPadDetected] = useState(false);
  const [flightState, setFlightState] = useState("OFFLINE");
  const [countdown, setCountdown] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  // Guard: only fire "Mission Complete" alert if module was actually running
  const wasEverActive = useRef(false);

  const [frameUri, setFrameUri] = useState(`${API_URL}/video/snapshot?t=0`);

  // --- VIDEO SNAPSHOT POLLING (React Native <Image> cannot render MJPEG streams) ---
  useEffect(() => {
    const id = setInterval(() => {
      setFrameUri(`${API_URL}/video/snapshot?t=${Date.now()}`);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // --- LIVE TELEMETRY POLLING ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (missionActive) {
      intervalId = setInterval(async () => {
        try {
          const response = await axios.get(`${API_URL}/api/module2/telemetry`);
          const data = response.data;

          if (data.status === "active") {
            wasEverActive.current = true;
            setFlightState(data.state);
            setPadDetected(data.pad_detected);
          } else if (data.status === "inactive" && wasEverActive.current) {
            // Only fire "complete" alert if the module was actually running first.
            // Prevents false trigger when polling catches the module before it starts.
            wasEverActive.current = false;
            setMissionActive(false);
            setPadDetected(false);
            setFlightState("OFFLINE");
            Alert.alert("Mission Complete", "The drone has landed.");
          }
        } catch (e) {
          console.log("Telemetry ping failed.");
        }
      }, 500);
    } else {
      setFlightState("OFFLINE");
      setPadDetected(false);
    }

    return () => clearInterval(intervalId);
  }, [missionActive]);

  const toggleMission = async () => {
    // 1. If currently counting down, CANCEL IT
    if (countdown !== null) {
      console.log('[MODULE 2] Countdown cancelled by user');
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }

    // 2. If mission is active, STOP IT
    if (missionActive) {
      console.log('[MODULE 2] Mission stopped by user');
      setMissionActive(false);
      axios.post(`${API_URL}/api/module1/sequence`, { commands: ['stop'] }).catch(() => {});
      return;
    }

    if (!await checkDroneConnected(API_URL)) return;

    // 3. Start the 3-second Countdown!
    console.log('[MODULE 2] Drone check passed — starting countdown');
    let count = 3;
    setCountdown(count);

    timerRef.current = setInterval(async () => {
      count -= 1;

      if (count > 0) {
        setCountdown(count);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        setPadDetected(false);
        wasEverActive.current = false;

        try {
          console.log('[MODULE 2] Sending takeoff + start landing-pad mission');
          await axios.post(`${API_URL}/api/module1/takeoff`);
          await axios.post(`${API_URL}/api/module2/start`);
          // Start telemetry polling only AFTER module is confirmed running
          setMissionActive(true);
          console.log('[MODULE 2] Mission commands sent successfully');
        } catch (e) {
          console.error('[MODULE 2] Failed to start mission:', e);
          Alert.alert("Error", "Could not reach drone.");
          setMissionActive(false);
        }
      }
    }, 1000);
  };

  const emergencyLand = async () => {
    // Instantly kill any active countdowns
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
    setMissionActive(false);
    
    try {
      await axios.post(`${API_URL}/api/module1/land`);
      Alert.alert("Emergency Land", "Drone is landing safely.");
    } catch (e) {
      Alert.alert("Error", "Failed to send land command!");
    }
  };

  // Determine what the Main Button should look like
  const getMainButtonUI = () => {
    if (countdown !== null) {
      return { text: "CANCEL COUNTDOWN", color: '#f59e0b', icon: <Square fill="white" color="white" size={24} /> };
    }
    if (missionActive) {
      return { text: "PAUSE MISSION", color: '#f59e0b', icon: <Square fill="white" color="white" size={24} /> };
    }
    return { text: "START MISSION", color: '#3b82f6', icon: <Play fill="white" color="white" size={24} /> };
  };

  const btnUI = getMainButtonUI();

  return (
    <View style={styles.container}>
      
      {/* LEFT SIDE: Control Panel */}
      <View style={styles.controlSection}>
        
        {/* 2. The ScrollView fills that 35% completely */}
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                router.back();
            }}>
              <XCircle color="#ef4444" size={32} />
            </TouchableOpacity>
            <Text style={[styles.title, { flex: 1 }]}>{moduleData.title}</Text>
            <DroneStatusBadge />
          </View>

          <Text style={styles.description}>
            The drone will take off, search for the landing pad using its down-facing camera, and autonomously center itself before landing.
          </Text>

          <View style={styles.telemetryBox}>
            <View style={styles.telemetryRow}>
              <Target color={padDetected ? "#10b981" : "#94a3b8"} size={24} />
              <Text style={styles.telemetryText}>
                Telemetry: <Text style={{ color: padDetected ? "#10b981" : "#ef4444", fontWeight: 'bold' }}>
                  {flightState} {/* THIS NOW SHOWS THE LIVE TEXT FROM PYTHON! */}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: btnUI.color }]} 
              onPress={toggleMission}
            >
              {btnUI.icon}
              <Text style={styles.btnText}>{btnUI.text}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerBtn} onPress={emergencyLand}>
              <AlertOctagon color="white" size={24} />
              <Text style={styles.btnText}>EMERGENCY LAND</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* RIGHT SIDE: Live Camera Feed */}
      <View style={styles.cameraSection}>
        <View style={styles.videoContainer}>
          <Image source={{ uri: frameUri }} style={styles.videoStream} contentFit="contain" cachePolicy="none" />
          
          <View style={styles.hudOverlay}>
            <Text style={styles.hudText}>● LIVE FEED</Text>
          </View>

          {/* MASSIVE COUNTDOWN OVERLAY */}
          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownSubtext}>STAND CLEAR. INITIATING TAKEOFF.</Text>
            </View>
          )}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' },
  controlSection: { flex: 0.35, backgroundColor: '#1e293b', borderRightWidth: 2, borderColor: '#334155' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  description: { color: '#94a3b8', fontSize: 14, marginBottom: 30, lineHeight: 20 },
  telemetryBox: { backgroundColor: '#0f172a', padding: 15, borderRadius: 10, marginBottom: 30, borderWidth: 1, borderColor: '#334155' },
  telemetryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 5 },
  telemetryText: { color: 'white', fontSize: 16, flexShrink: 1 },
  buttonContainer: { gap: 15, marginTop: 'auto' },
  mainBtn: { flexDirection: 'row', padding: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 10 },
  dangerBtn: { flexDirection: 'row', backgroundColor: '#ef4444', padding: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Camera & Overlay Styles
  cameraSection: { flex: 0.65, padding: 20, justifyContent: 'center', alignItems: 'center' },
  videoContainer: { width: '100%', height: '100%', backgroundColor: 'black', borderRadius: 15, overflow: 'hidden', borderWidth: 2, borderColor: '#334155', position: 'relative' },
  videoStream: { width: '100%', height: '100%' },
  hudOverlay: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, borderWidth: 1, borderColor: '#ef4444' },
  hudText: { color: '#ef4444', fontWeight: 'bold', letterSpacing: 1 },

  // NEW: Countdown specific styles
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject, // Fills the entire video box perfectly
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownNumber: {
    color: '#3b82f6',
    fontSize: 120, // Massive text!
    fontWeight: '900',
  },
  countdownSubtext: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 10,
  }
});