import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Lock, Play, Gamepad2, CheckCircle, User } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Static module definitions (The descriptions/titles)
const MODULE_DEFS = [
  { id: 1, title: "Basic Flight", desc: "Takeoff & Landing" },
  { id: 2, title: "Landing Pads", desc: "Precision Vision" },
  { id: 3, title: "Object Tracking", desc: "Computer Vision" },
  { id: 4, title: "Voice Control", desc: "Speech-to-Text" },
  { id: 5, title: "Swarm Logic", desc: "Multi-Drone Sync" },
];

export default function Dashboard() {
  const router = useRouter();
  const theme = Colors.dark;
  
  // Real data state
  const [userModules, setUserModules] = useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [username, setUsername] = useState('Pilot');
  const [avatar, setAvatar] = useState<string | null>(null);

  // The function that fetches fresh data from your server
  const fetchProgress = async () => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      
      const storedUsername = await AsyncStorage.getItem('user_username');
      if (storedUsername) setUsername(storedUsername);

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!token || !apiUrl) return;

      const response = await axios.get(`${apiUrl}/api/user/sync`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update state with the real dictionary of modules from MongoDB
      if (response.data && response.data.modules) {
        setUserModules(response.data.modules);
        if (response.data.avatar) {
          setAvatar(response.data.avatar);
        }
      }
    } catch (error) {
      console.error("[SYNC ERROR]", error);
    } finally {
      setInitialLoad(false);
    }
  };

  // 1. AUTO-SYNC: Runs every time the user looks at this screen
  useFocusEffect(
    useCallback(() => {
      fetchProgress();
    }, [])
  );

  // 2. MANUAL SYNC: Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProgress();
    setRefreshing(false);
  }, []);

  const handleModulePress = (modId: number, isLocked: boolean): void => {
    if (!isLocked) {
      router.push({ pathname: "./module", params: { id: modId } });
    }
  };

  const getAvatarSource = () => {
    if (!avatar || avatar === "") return null;
    const baseUrl = process.env.EXPO_PUBLIC_API_URL;

    // Convert Windows backslashes to web forward slashes
    let cleanAvatarPath = avatar.replace(/\\/g, '/');
    if (!cleanAvatarPath.startsWith('/')) {
        cleanAvatarPath = `/${cleanAvatarPath}`;
    }
    
    const fullUri = `${baseUrl}${cleanAvatarPath}`;
    console.log("Loading Avatar URI:", fullUri); // Check your terminal to verify!
    
    return { uri: fullUri };
  };

  const avatarSource = getAvatarSource();

  if (initialLoad) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Syncing Flight Data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.header, { color: theme.text }]}>Mission Select</Text>
        
        <View style={styles.profileContainer}>
          <Text style={[styles.pilotName, { color: theme.textSecondary }]}>Pilot {username}</Text>
          {avatarSource ? (
            <Image 
              source={avatarSource} 
              style={styles.avatarImage} 
              key={avatarSource.uri} // Forces image to refresh if URL changes
            />
          ) : (
            <View style={[styles.avatarImage, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
              <User color="white" size={20} />
            </View>
          )}
        </View>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.grid}
        // Add the Pull-to-Refresh gesture here!
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
        }
      >
        {MODULE_DEFS.map((mod) => {
          // Cross-reference static definitions with live user data from DB
          const modStringId = mod.id.toString();
          const dbData = userModules[modStringId];
          const status = dbData ? dbData.status : 'locked';
          
          const isLocked = status === 'locked';
          const isCompleted = status === 'completed';

          return (
            <TouchableOpacity 
              key={mod.id} 
              onPress={() => handleModulePress(mod.id, isLocked)}
              activeOpacity={isLocked ? 1 : 0.7}
              style={[
                styles.card, 
                { 
                  backgroundColor: theme.card, 
                  borderColor: isCompleted ? theme.success : (isLocked ? theme.border : theme.tint),
                  opacity: isLocked ? 0.6 : 1 // Dim locked modules
                }
              ]}
            >
              <View style={styles.cardTop}>
                  <Text style={[styles.title, { color: isLocked ? theme.textSecondary : theme.text }]}>
                    {mod.title}
                  </Text>
                  
                  {/* Dynamic Icons based on real DB status */}
                  {isCompleted ? (
                    <CheckCircle size={20} color={theme.success} />
                  ) : isLocked ? (
                    <Lock size={20} color={theme.textSecondary} />
                  ) : (
                    <Play size={20} color={theme.tint} />
                  )}
              </View>
              <Text style={{color: theme.textSecondary}}>{mod.desc}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Free Fly Card */}
        <TouchableOpacity style={[styles.freeFly, { backgroundColor: theme.tint }]} onPress={() => router.push("./free-flight")}>
            <Gamepad2 color="white" size={32} />
            <Text style={styles.ffText}>FREE FLIGHT</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  header: { fontSize: 24, fontWeight: 'bold' },
  profileContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pilotName: { fontSize: 14, fontWeight: '600', display: 'flex' },
  avatarImage: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#3b82f6' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  card: { width: '31%', padding: 20, borderRadius: 12, borderWidth: 1, minHeight: 100, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontWeight: 'bold', fontSize: 16 },
  freeFly: { width: '100%', padding: 20, borderRadius: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 15 },
  ffText: { color: 'white', fontWeight: 'bold', fontSize: 20 }
});