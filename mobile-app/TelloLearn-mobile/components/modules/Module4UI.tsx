import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { XCircle, Play, Square, AlertOctagon, Mic, Navigation, MoveUpRight, Target } from 'lucide-react-native';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { checkDroneConnected } from '@/utils/droneCheck';

export default function Module4UI({ moduleData }: { moduleData: any }) {
  const router = useRouter();
  
  // Mission & Voice State
  const [missionActive, setMissionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Telemetry State (Spatial Navigation)
  const [flightState, setFlightState] = useState("OFFLINE");
  const [currentTarget, setCurrentTarget] = useState("");
  const [totalDistance, setTotalDistance] = useState(0);
  const [vector, setVector] = useState([0, 0]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverIp = process.env.EXPO_PUBLIC_API_URL;
  const videoStreamUrl = `${serverIp}/video_feed`;

  // --- LIVE TELEMETRY POLLING ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (missionActive) {
      intervalId = setInterval(async () => {
        try {
          const response = await axios.get(`${serverIp}/api/module4/telemetry`);
          const data = response.data;

          setFlightState(data.state);
          setCurrentTarget(data.current_target);
          setTotalDistance(data.total_distance);
          setVector(data.next_vector);

          if (data.status === "inactive" && data.state === "MISSION_COMPLETE") {
            setMissionActive(false);
            Alert.alert("Navigation Finished", `Route Complete! Total Distance: ${data.total_distance}cm`);
          }
        } catch (e) {
          console.log("Telemetry ping failed.");
        }
      }, 500);
    } else {
        if (flightState !== "MISSION_COMPLETE") setFlightState("OFFLINE");
    }

    return () => clearInterval(intervalId);
  }, [missionActive, serverIp, flightState]);

  // --- SIMULATED SPEECH RECOGNITION ---
  const handleVoiceInput = () => {
    setIsRecording(true);
    // Simulating a 2-second voice processing delay
    setTimeout(() => {
      const mockWords = ["HELLO", "FLY", "DRONE", "FYP", "PATH"];
      const randomWord = mockWords[Math.floor(Math.random() * mockWords.length)];
      setTranscribedText(randomWord);
      setIsRecording(false);
    }, 2000);
  };

  const toggleMission = async () => {
    if (countdown !== null) {
      console.log('[MODULE 4] Countdown cancelled by user');
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }

    if (missionActive) {
      console.log('[MODULE 4] Mission stopped by user');
      setMissionActive(false);
      axios.post(`${serverIp}/api/module1/land`).catch(() => {});
      return;
    }

    if (!transcribedText) {
      Alert.alert("No Input", "Please use the microphone to input a word first.");
      return;
    }

    if (!await checkDroneConnected()) return;

    console.log(`[MODULE 4] Drone check passed — starting countdown for word: "${transcribedText}"`);
    let count = 3;
    setCountdown(count);

    timerRef.current = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        setMissionActive(true);

        try {
          console.log(`[MODULE 4] Sending takeoff + start navigation for word: "${transcribedText}"`);
          await axios.post(`${serverIp}/api/module1/takeoff`);
          await axios.post(`${serverIp}/api/module4/start`, { word: transcribedText });
          console.log('[MODULE 4] Mission commands sent successfully');
        } catch (e) {
          console.error('[MODULE 4] Failed to start mission:', e);
          Alert.alert("Error", "Could not reach backend.");
          setMissionActive(false);
        }
      }
    }, 1000);
  };

  const emergencyLand = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
    setMissionActive(false);
    axios.post(`${serverIp}/api/module1/land`);
  };

  return (
    <View style={styles.container}>
      {/* LEFT: SPEECH & TELEMETRY */}
      <View style={styles.controlSection}>
        <ScrollView contentContainerStyle={{ padding: 25 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}><XCircle color="#ef4444" size={32} /></TouchableOpacity>
            <Text style={[styles.title, { flex: 1 }]}>{moduleData?.title || "Shortest Path Navigation"}</Text>
            <DroneStatusBadge />
          </View>

          {/* Speech Section */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SPEECH INPUT</Text>
            <TouchableOpacity 
              style={[styles.micBtn, isRecording && styles.micBtnActive]} 
              onPress={handleVoiceInput}
              disabled={missionActive || isRecording}
            >
              {isRecording ? <ActivityIndicator color="white" /> : <Mic color="white" size={30} />}
            </TouchableOpacity>
            <Text style={styles.transcribedText}>
              {isRecording ? "Listening..." : (transcribedText || "Tap Mic to Speak")}
            </Text>
          </View>

          {/* Spatial Telemetry Section */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SPATIAL TELEMETRY</Text>
            <View style={styles.statRow}>
                <Navigation color="#3b82f6" size={20} />
                <Text style={styles.statText}>State: <Text style={styles.highlight}>{flightState}</Text></Text>
            </View>
            <View style={styles.statRow}>
                <Target color="#10b981" size={20} />
                <Text style={styles.statText}>Target Letter: <Text style={styles.highlight}>{currentTarget || "-"}</Text></Text>
            </View>
            <View style={styles.statRow}>
                <MoveUpRight color="#f59e0b" size={20} />
                <Text style={styles.statText}>Vector: <Text style={styles.highlight}>X:{vector[0]} Y:{vector[1]}</Text></Text>
            </View>
            <View style={styles.distBox}>
                <Text style={styles.distLabel}>TOTAL DISTANCE</Text>
                <Text style={styles.distValue}>{totalDistance} cm</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: missionActive ? '#f59e0b' : '#3b82f6' }]} 
            onPress={toggleMission}
          >
            {missionActive ? <Square color="white" size={24} /> : <Play color="white" size={24} />}
            <Text style={styles.btnText}>{missionActive ? "PAUSE MISSION" : "START MISSION"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={emergencyLand}>
             <AlertOctagon color="white" size={24} />
             <Text style={styles.btnText}>EMERGENCY LAND</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* RIGHT: HUD & CAMERA */}
      <View style={styles.cameraSection}>
         <View style={styles.videoBox}>
            <Image source={{ uri: videoStreamUrl }} style={styles.video} resizeMode="contain" />
            {countdown !== null && (
                <View style={styles.overlay}>
                    <Text style={styles.countdown}>{countdown}</Text>
                </View>
            )}
         </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' },
  controlSection: { flex: 0.4, backgroundColor: '#1e293b', borderRightWidth: 1, borderColor: '#334155' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: '#0f172a', padding: 20, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  cardLabel: { color: '#64748b', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15, alignSelf: 'flex-start' },
  micBtn: { backgroundColor: '#3b82f6', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  micBtnActive: { backgroundColor: '#ef4444' },
  transcribedText: { color: 'white', fontSize: 22, fontWeight: 'bold', letterSpacing: 2 },
  statRow: { flexDirection: 'row', width: '100%', alignItems: 'center', gap: 10, marginBottom: 12 },
  statText: { color: '#94a3b8', fontSize: 16 },
  highlight: { color: 'white', fontWeight: 'bold' },
  distBox: { marginTop: 15, backgroundColor: '#1e293b', width: '100%', padding: 15, borderRadius: 10, alignItems: 'center' },
  distLabel: { color: '#3b82f6', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  distValue: { color: 'white', fontSize: 32, fontWeight: '900' },
  actionBtn: { flexDirection: 'row', padding: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 15 },
  dangerBtn: { flexDirection: 'row', backgroundColor: '#ef4444', padding: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cameraSection: { flex: 0.6, padding: 20 },
  videoBox: { flex: 1, backgroundColor: 'black', borderRadius: 20, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  countdown: { color: '#3b82f6', fontSize: 150, fontWeight: '900' }
});