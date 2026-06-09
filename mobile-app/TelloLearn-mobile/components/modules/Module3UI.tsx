import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { XCircle, Play, Square, AlertOctagon, Target, Type } from 'lucide-react-native';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { checkDroneConnected } from '@/utils/droneCheck';

export default function Module3UI({ moduleData }: { moduleData: any }) {
  const router = useRouter();
  
  // Mission State
  const [missionActive, setMissionActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [targetWord, setTargetWord] = useState("");
  
  // Telemetry State
  const [flightState, setFlightState] = useState("OFFLINE");
  const [currentTarget, setCurrentTarget] = useState("");
  const [spelledSoFar, setSpelledSoFar] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const serverIp = process.env.EXPO_PUBLIC_API_URL;
  const videoStreamUrl = `${serverIp}/video_feed`;

  // --- LIVE TELEMETRY POLLING ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (missionActive) {
      intervalId = setInterval(async () => {
        try {
          const response = await axios.get(`${serverIp}/api/module3/telemetry`);
          const data = response.data;

          setFlightState(data.state);
          setCurrentTarget(data.current_target);
          setSpelledSoFar(data.spelled_so_far);

          // Detect when the word is finished and the drone lands
          if (data.status === "inactive" && data.state === "MISSION_COMPLETE") {
            setMissionActive(false);
            setFlightState("COMPLETED");
            Alert.alert("Mission Complete!", `The drone successfully spelled: ${data.full_word}`);
          }
        } catch (e) {
          console.log("Telemetry ping failed.");
        }
      }, 500);
    } else {
      // Clean up UI if not running
      if (flightState !== "COMPLETED") {
        setFlightState("OFFLINE");
        setCurrentTarget("");
      }
    }

    return () => clearInterval(intervalId);
  }, [missionActive, serverIp, flightState]);

  const toggleMission = async () => {
    if (countdown !== null) {
      console.log('[MODULE 3] Countdown cancelled by user');
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }

    if (missionActive) {
      console.log('[MODULE 3] Mission stopped by user');
      setMissionActive(false);
      axios.post(`${serverIp}/api/module1/land`).catch(() => {});
      return;
    }

    // Input Validation
    if (targetWord.trim().length === 0) {
      Alert.alert("Invalid Input", "Please enter a word for the drone to spell.");
      return;
    }

    if (!await checkDroneConnected()) return;

    console.log(`[MODULE 3] Drone check passed — starting countdown for word: "${targetWord.toUpperCase()}"`);
    let count = 3;
    setCountdown(count);
    setSpelledSoFar("");

    timerRef.current = setInterval(async () => {
      count -= 1;

      if (count > 0) {
        setCountdown(count);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        setMissionActive(true);

        try {
          console.log(`[MODULE 3] Sending takeoff + start alphabet mission for: "${targetWord.toUpperCase()}"`);
          await axios.post(`${serverIp}/api/module1/takeoff`);
          await axios.post(`${serverIp}/api/module3/start`, { word: targetWord.toUpperCase() });
          console.log('[MODULE 3] Mission commands sent successfully');
        } catch (e) {
          console.error('[MODULE 3] Failed to start mission:', e);
          Alert.alert("Error", "Could not reach backend to start Module 3.");
          setMissionActive(false);
        }
      }
    }, 1000);
  };

  const emergencyLand = async () => {
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      
      {/* LEFT SIDE: Control Panel */}
      <View style={styles.controlSection}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                router.back();
            }}>
              <XCircle color="#ef4444" size={32} />
            </TouchableOpacity>
            <Text style={[styles.title, { flex: 1 }]}>{moduleData?.title || "Alphabet Recognition"}</Text>
            <DroneStatusBadge />
          </View>

          <Text style={styles.description}>
            Enter a word below. The drone will autonomously search for each letter, align itself, and hover to spell the word.
          </Text>

          {/* NEW: Text Input Area */}
          <View style={styles.inputContainer}>
            <Type color="#94a3b8" size={20} />
            <TextInput 
              style={styles.textInput}
              placeholder="Enter target word..."
              placeholderTextColor="#64748b"
              value={targetWord}
              onChangeText={setTargetWord}
              autoCapitalize="characters"
              maxLength={10}
              editable={!missionActive && countdown === null} // Disable input while flying!
            />
          </View>

          {/* UPGRADED: Telemetry Box */}
          <View style={styles.telemetryBox}>
            <View style={styles.telemetryRow}>
              <Target color={missionActive ? "#10b981" : "#94a3b8"} size={24} />
              <Text style={styles.telemetryText}>
                State: <Text style={{ color: missionActive ? "#10b981" : "#ef4444", fontWeight: 'bold' }}>{flightState}</Text>
              </Text>
            </View>
            
            <View style={[styles.telemetryRow, { marginTop: 15 }]}>
              <Text style={styles.telemetryLabel}>Looking For:</Text>
              <Text style={styles.targetLetter}>{currentTarget || "-"}</Text>
            </View>

            <View style={[styles.telemetryRow, { marginTop: 10 }]}>
              <Text style={styles.telemetryLabel}>Spelled So Far:</Text>
              <Text style={styles.spelledText}>{spelledSoFar || "..."}</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: btnUI.color }]} onPress={toggleMission}>
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

          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownSubtext}>STAND CLEAR. INITIATING TAKEOFF.</Text>
            </View>
          )}
        </View>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' },
  controlSection: { flex: 0.35, backgroundColor: '#1e293b', borderRightWidth: 2, borderColor: '#334155' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  description: { color: '#94a3b8', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  
  // Input Styles
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 15, marginBottom: 20 },
  textInput: { flex: 1, color: 'white', fontSize: 18, fontWeight: 'bold', paddingVertical: 15, marginLeft: 10, letterSpacing: 2 },
  
  // Telemetry Styles
  telemetryBox: { backgroundColor: '#0f172a', padding: 15, borderRadius: 10, marginBottom: 30, borderWidth: 1, borderColor: '#334155' },
  telemetryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  telemetryText: { color: 'white', fontSize: 16 },
  telemetryLabel: { color: '#94a3b8', fontSize: 14, width: 100 },
  targetLetter: { color: '#f59e0b', fontSize: 24, fontWeight: '900' },
  spelledText: { color: '#10b981', fontSize: 20, fontWeight: 'bold', letterSpacing: 5 },
  
  // Button Styles
  buttonContainer: { gap: 15, marginTop: 'auto' },
  mainBtn: { flexDirection: 'row', padding: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 10 },
  dangerBtn: { flexDirection: 'row', backgroundColor: '#ef4444', padding: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Camera Styles
  cameraSection: { flex: 0.65, padding: 20, justifyContent: 'center', alignItems: 'center' },
  videoContainer: { width: '100%', height: '100%', backgroundColor: 'black', borderRadius: 15, overflow: 'hidden', borderWidth: 2, borderColor: '#334155', position: 'relative' },
  videoStream: { width: '100%', height: '100%' },
  hudOverlay: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, borderWidth: 1, borderColor: '#ef4444' },
  hudText: { color: '#ef4444', fontWeight: 'bold', letterSpacing: 1 },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  countdownNumber: { color: '#3b82f6', fontSize: 120, fontWeight: '900' },
  countdownSubtext: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, marginTop: 10 }
});