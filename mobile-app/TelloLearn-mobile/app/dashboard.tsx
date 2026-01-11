import React, { useState } from 'react'; // Add useEffect/axios logic as before
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Lock, Play, Gamepad2 } from 'lucide-react-native';

const MODULES = [
  { id: 1, title: "Basic Flight", desc: "Takeoff & Landing" },
  { id: 2, title: "Landing Pads", desc: "Precision Vision" },
  { id: 3, title: "Object Tracking", desc: "Computer Vision" },
  { id: 4, title: "Voice Control", desc: "Speech-to-Text" },
  { id: 5, title: "Swarm Logic", desc: "Multi-Drone Sync" },
];

export default function Dashboard() {
  const router = useRouter();
  const theme = Colors.dark;
  const [unlockedLevel] = useState(2); // Mocked for demo

  const handleModulePress = (modId: number): void => {
    if (modId <= unlockedLevel) {
      // Pass the module ID to the next screen
      router.push({ pathname: "./module", params: { id: modId } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.text }]}>Mission Select</Text>
      
      <ScrollView contentContainerStyle={styles.grid}>
        {MODULES.map((mod) => (
          <TouchableOpacity 
            key={mod.id} 
            onPress={() => handleModulePress(mod.id)}
            style={[styles.card, { backgroundColor: theme.card, borderColor: mod.id <= unlockedLevel ? theme.success : theme.border }]}
          >
            <View style={styles.cardTop}>
                <Text style={[styles.title, { color: theme.text }]}>{mod.title}</Text>
                {mod.id <= unlockedLevel ? <Play size={20} color={theme.success}/> : <Lock size={20} color={theme.textSecondary}/>}
            </View>
            <Text style={{color: theme.textSecondary}}>{mod.desc}</Text>
          </TouchableOpacity>
        ))}

        {/* Free Fly Card */}
        <TouchableOpacity style={[styles.freeFly, { backgroundColor: theme.tint }]}>
            <Gamepad2 color="white" size={32} />
            <Text style={styles.ffText}>FREE FLIGHT</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  card: { width: '31%', padding: 20, borderRadius: 12, borderWidth: 1, minHeight: 100, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontWeight: 'bold', fontSize: 16 },
  freeFly: { width: '100%', padding: 20, borderRadius: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 15 },
  ffText: { color: 'white', fontWeight: 'bold', fontSize: 20 }
});