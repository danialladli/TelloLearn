import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Colors } from '@/constants/theme';
import { Lock, Play, Gamepad2, CheckCircle, User, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { useApiUrl } from '@/utils/apiConfig';

// Static module definitions (The descriptions/titles)
const MODULE_DEFS = [
  { id: 1, title: "Basic Flight", desc: "Takeoff & Landing" },
  { id: 2, title: "Landing Pads", desc: "Precision Vision" },
  { id: 3, title: "Object Tracking", desc: "Computer Vision" },
  { id: 4, title: "Voice Control", desc: "Speech-to-Text" },
  { id: 5, title: "Swarm Logic", desc: "Multi-Drone Sync" },
];

export default function Dashboard() {
  const { apiUrl: API_URL, backendIp, setBackendIp } = useApiUrl();
  const router = useRouter();
  const theme = Colors.dark;
  
  // Real data state
  const [userModules, setUserModules] = useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [username, setUsername] = useState('Pilot');
  const [avatar, setAvatar] = useState<string | null>(null);

  // IP settings modal
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipInput, setIpInput] = useState(backendIp);

  // The function that fetches fresh data from your server
  const fetchProgress = async () => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      
      const storedUsername = await AsyncStorage.getItem('user_username');
      if (storedUsername) setUsername(storedUsername);

      if (!token) return;

      const response = await axios.get(`${API_URL}/api/user/sync`, {
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

  // 1. AUTO-SYNC: Runs every time the user returns to this screen
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

  // 3. LOGOUT: Clear credentials and return to login
  const handleLogout = () => {
    console.log('[LOGOUT] User initiated logout');
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            console.log('[LOGOUT] Confirmed — clearing session and navigating to login');
            await AsyncStorage.multiRemove(['user_token', 'user_username']);
            // Lock to portrait BEFORE navigating so login never paints in landscape
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            router.replace('./login');
          },
        },
      ]
    );
  };

  const handleModulePress = (modId: number, isLocked: boolean): void => {
    if (!isLocked) {
      router.push({ pathname: "./module", params: { id: modId } });
    }
  };

  const getAvatarSource = () => {
    if (!avatar || avatar === "") return null;
    const baseUrl = API_URL;

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

        <DroneStatusBadge />

        <TouchableOpacity onPress={() => { setIpInput(backendIp); setShowIpModal(true); }}>
          <Settings color={theme.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileContainer} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={[styles.pilotName, { color: theme.textSecondary }]}>Pilot {username}</Text>
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={styles.avatarImage}
              key={avatarSource.uri}
            />
          ) : (
            <View style={[styles.avatarImage, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
              <User color="white" size={20} />
            </View>
          )}
        </TouchableOpacity>
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

      <Modal visible={showIpModal} transparent animationType="fade" onRequestClose={() => setShowIpModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Backend Server IP</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>Current: {backendIp}:8000</Text>
            <TextInput
              style={[styles.ipInput, { color: theme.text, borderColor: theme.border }]}
              value={ipInput}
              onChangeText={setIpInput}
              placeholder="e.g. 192.168.43.100"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.border }]} onPress={() => setShowIpModal(false)}>
                <Text style={{ color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.tint, flex: 1 }]}
                onPress={async () => { await setBackendIp(ipInput.trim()); setShowIpModal(false); }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  ffText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: 300, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalSub: { fontSize: 12, marginBottom: 16 },
  ipInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 4 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});