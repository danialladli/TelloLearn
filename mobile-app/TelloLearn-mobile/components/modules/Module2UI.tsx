import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { XCircle, Play, Square, AlertOctagon, Target } from 'lucide-react-native';
import axios from 'axios';

export default function Module2({ moduleData }: { moduleData: any }) {
  const router = useRouter();
  
  const [missionActive, setMissionActive] = useState(false);
  const [padDetected, setPadDetected] = useState(false);
  const [flightState, setFlightState] = useState("OFFLINE");
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Ref to hold the timer so we can cancel it if needed
  const timerRef = useRef<number | null>(null);

  const serverIp = process.env.EXPO_PUBLIC_API_URL;
  const videoStreamUrl = `${serverIp}/video_feed`;

  // --- LIVE TELEMETRY POLLING ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (missionActive) {
      // Ping the server every 500 milliseconds (half a second)
      intervalId = setInterval(async () => {
        try {
          const response = await axios.get(`${serverIp}/api/module2/telemetry`);
          const data = response.data;

          setFlightState(data.state);
          setPadDetected(data.pad_detected);

          // Detect when the landing successfully finishes!
          if (data.status === "inactive") {
            setMissionActive(false);
            setPadDetected(false);
            setFlightState("OFFLINE");
            Alert.alert("Landing Complete", "The drone has successfully touched down.");
          }
        } catch (e) {
          console.log("Telemetry ping failed.");
        }
      }, 500);
    } else {
      // Reset when mission is paused/stopped
      setFlightState("OFFLINE");
      setPadDetected(false);
    }

    // Cleanup the interval if the component unmounts or mission stops
    return () => clearInterval(intervalId);
  }, [missionActive, serverIp]);

  const toggleMission = () => {
    // 1. If currently counting down, CANCEL IT
    if (countdown !== null) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }

    // 2. If mission is active, STOP IT
    if (missionActive) {
      setMissionActive(false);
      axios.post(`${serverIp}/api/module1/sequence`, { commands: ['stop'] }).catch(() => {});
      return;
    }

    // 3. Start the 3-second Countdown!
    let count = 3;
    setCountdown(count);
    
    timerRef.current = setInterval(async () => {
      count -= 1;
      
      if (count > 0) {
        setCountdown(count);
      } else {
        // Countdown finished! 
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        setMissionActive(true);
        setPadDetected(false); // Reset telemetry

        try {
          // Tell Python to takeoff, then immediately trigger the CV landing loop
          await axios.post(`${serverIp}/api/module1/takeoff`);
          await axios.post(`${serverIp}/api/module2/start`);
        } catch (e) {
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
      await axios.post(`${serverIp}/api/module1/land`);
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
            <Text style={styles.title}>{moduleData.title}</Text>
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
          <Image source={{ uri: videoStreamUrl }} style={styles.videoStream} resizeMode="contain" />
          
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