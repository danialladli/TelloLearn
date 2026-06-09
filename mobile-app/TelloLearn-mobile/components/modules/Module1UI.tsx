import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, XCircle, Trash2 } from 'lucide-react-native';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { checkDroneConnected } from '@/utils/droneCheck';

// 1. DEFINE OUR CODING BLOCKS
const AVAILABLE_BLOCKS = [
  // Flight Controls
  { id: 'takeoff', label: 'Takeoff 🛫', color: '#3b82f6', command: 'takeoff' },
  { id: 'land', label: 'Land 🛬', color: '#ef4444', command: 'land' },
  
  // Vertical Movement
  { id: 'up', label: 'Move Up 30cm ⬆️', color: '#10b981', command: 'up 30' },
  { id: 'down', label: 'Move Down 30cm ⬇️', color: '#10b981', command: 'down 30' },
  
  // Horizontal Movement
  { id: 'forward', label: 'Forward 50cm ⏫', color: '#8b5cf6', command: 'forward 50' },
  { id: 'backward', label: 'Backward 50cm ⏬', color: '#8b5cf6', command: 'back 50' },
  { id: 'left', label: 'Left 50cm ⏪', color: '#8b5cf6', command: 'left 50' },
  { id: 'right', label: 'Right 50cm ⏩', color: '#8b5cf6', command: 'right 50' },
  
  // Rotations (Clockwise)
  { id: 'cw90', label: 'Rotate 90° ⤵️', color: '#f59e0b', command: 'cw 90' },
  { id: 'cw180', label: 'Rotate 180° 🔄', color: '#f59e0b', command: 'cw 180' },
  { id: 'cw270', label: 'Rotate 270° 🔃', color: '#f59e0b', command: 'cw 270' },
  { id: 'cw360', label: 'Rotate 360° 🌀', color: '#f59e0b', command: 'cw 360' },
];

export default function Module1UI ({ moduleData }: { moduleData: any }) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [sequence, setSequence] = useState<typeof AVAILABLE_BLOCKS>([]);

  // --- ACTIONS ---
  const addBlock = (block: typeof AVAILABLE_BLOCKS[0]) => setSequence([...sequence, block]);
  
  const removeBlock = (indexToRemove: number) => {
    setSequence(sequence.filter((_, index) => index !== indexToRemove));
  };

  const clearSequence = () => setSequence([]);

  const handleRunSequence = async () => {
    if (sequence.length === 0) {
      Alert.alert("Empty Flight Plan", "Please add some blocks to your sequence first!");
      return;
    }

    if (!await checkDroneConnected()) return;

    setIsRunning(true);
    try {
        const commandsToSend = sequence.map(b => b.command);
        const serverIp = process.env.EXPO_PUBLIC_API_URL;

        console.log('[MODULE 1] Executing sequence:', commandsToSend);

        await axios.post(`${serverIp}/api/module1/sequence`, {
            commands: commandsToSend
        });

        console.log('[MODULE 1] Sequence complete');
        Alert.alert("Mission Complete", "The drone has finished the sequence.");
    } catch (e) {
        console.error('[MODULE 1] Sequence failed:', e);
        Alert.alert("Mission Failed", "Could not reach the drone.");
    } finally {
        setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* LEFT SIDE: The White Canvas */}
      <View style={styles.canvasSection}>
        <View style={styles.canvasHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <XCircle color="black" size={30} />
          </TouchableOpacity>
          <Text style={styles.canvasTitle}>{moduleData.title || "Flight Sequence"}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <DroneStatusBadge />
            <TouchableOpacity onPress={clearSequence}>
              <Trash2 color="#ef4444" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.sequenceList}>
          {sequence.length === 0 ? (
            <Text style={styles.emptyText}>Tap blocks on the right to build your code!</Text>
          ) : (
            sequence.map((block, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.activeBlock, { backgroundColor: block.color }]}
                onPress={() => removeBlock(index)}
              >
                <Text style={styles.blockText}>{index + 1}. {block.label}</Text>
                <XCircle color="rgba(255,255,255,0.5)" size={20} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* RIGHT SIDE: Dark Toolbox */}
      <View style={styles.toolboxSection}>
        <View style={styles.toolboxHeader}>
          <Text style={styles.toolboxTitle}>Command Blocks</Text>
          <TouchableOpacity 
              style={[styles.playBtn, { opacity: isRunning ? 0.5 : 1 }]}
              onPress={handleRunSequence}
              disabled={isRunning}
          >
              {isRunning ? <ActivityIndicator color="white" /> : <Play fill="white" color="white" size={20} />}
              <Text style={styles.playText}>RUN</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.toolboxList}>
          {AVAILABLE_BLOCKS.map((block) => (
            <TouchableOpacity 
              key={block.id} 
              style={[styles.toolBlock, { borderColor: block.color }]}
              onPress={() => addBlock(block)}
            >
              <Text style={[styles.toolBlockText, { color: block.color }]}>{block.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  canvasSection: { flex: 0.65, backgroundColor: '#f8fafc', padding: 20 },
  canvasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  canvasTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  emptyText: { color: '#94a3b8', fontSize: 18, textAlign: 'center', marginTop: 50, fontStyle: 'italic' },
  sequenceList: { gap: 10, paddingBottom: 40 },
  activeBlock: { 
    padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2
  },
  blockText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  toolboxSection: { flex: 0.35, backgroundColor: '#0f172a', borderLeftWidth: 1, borderColor: '#334155', padding: 20 },
  toolboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  toolboxTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  playBtn: { flexDirection: 'row', backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, alignItems: 'center', gap: 5 },
  playText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  toolboxList: { gap: 12 },
  toolBlock: { padding: 16, borderRadius: 10, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderStyle: 'dashed' },
  toolBlockText: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
});