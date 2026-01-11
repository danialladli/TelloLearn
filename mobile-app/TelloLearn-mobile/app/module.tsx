import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Play, XCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function ModuleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Get module ID (e.g., "1")
  const theme = Colors.dark;
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('serverIp').then(setServerIp);
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    try {
        // Trigger the Python script on the PC
        // The PC will execute the python code associated with this module
        await axios.post(`http://${serverIp}:8000/api/execute/${id}`);
        alert("Mission Started!");
    } catch (e) {
        alert("Failed to start mission");
    } finally {
        setIsRunning(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* LEFT: Live Drone Feed */}
      <View style={styles.videoSection}>
        {serverIp ? (
            // We use an Image component that constantly reloads the MJPEG stream from Python
            <Image 
                source={{ uri: `http://${serverIp}:8000/video_feed` }} 
                style={styles.videoStream}
                resizeMode="contain"
            />
        ) : (
            <View style={styles.placeholder}>
                <ActivityIndicator size="large" color={theme.tint} />
                <Text style={{color: theme.textSecondary}}>Connecting to Video Feed...</Text>
            </View>
        )}
        
        {/* Overlay: Module Title */}
        <View style={styles.overlay}>
            <Text style={styles.overlayText}>Module {id} Live Feed</Text>
        </View>
      </View>

      {/* RIGHT: Controls */}
      <View style={[styles.controlSection, { borderLeftColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <XCircle color={theme.textSecondary} size={30} />
        </TouchableOpacity>

        <View style={styles.centerControls}>
            <Text style={[styles.instruction, { color: theme.text }]}>Ready to execute?</Text>
            <Text style={{color: theme.textSecondary, textAlign: 'center', marginBottom: 30}}>
                Ensure drone area is clear.
            </Text>

            <TouchableOpacity 
                style={[styles.runBtn, { backgroundColor: isRunning ? theme.border : theme.success }]}
                onPress={handleRun}
                disabled={isRunning}
            >
                {isRunning ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Play fill="white" color="white" size={30} />
                        <Text style={styles.runText}>RUN MISSION</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  
  // Left Side
  videoSection: { flex: 0.65, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  videoStream: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: 10 },
  overlay: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 5 },
  overlayText: { color: 'white', fontWeight: 'bold' },

  // Right Side
  controlSection: { flex: 0.35, backgroundColor: Colors.dark.card, borderLeftWidth: 1, padding: 20 },
  closeBtn: { alignSelf: 'flex-end' },
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  instruction: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  runBtn: { 
    width: '100%', height: 80, borderRadius: 16, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
  },
  runText: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }
});