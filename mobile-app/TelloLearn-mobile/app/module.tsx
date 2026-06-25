import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useApiUrl } from '@/utils/apiConfig';

import Module1UI from '@/components/modules/Module1UI';
import Module2UI from '@/components/modules/Module2UI';
import Module3UI from '../components/modules/Module3UI';
import Module4UI from '../components/modules/Module4UI';
import Module5UI from '../components/modules/Module5UI';

export default function ModuleScreen() {
  const { apiUrl: API_URL } = useApiUrl();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const moduleKey = Array.isArray(id) ? id[0] : String(id);

  const [moduleData, setModuleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // null = still checking, true = allowed, false = locked/no access
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);

  // --- ACCESS CHECK: verify module status from server before rendering ---
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const token = await AsyncStorage.getItem('user_token');
        if (!token) {
          router.replace('./login');
          return;
        }

        const response = await axios.get(`${API_URL}/api/user/sync`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const status = response.data.modules?.[moduleKey]?.status;
        // Only 'active' or 'completed' modules are accessible on the mobile app
        setAccessGranted(status === 'active' || status === 'completed');
      } catch {
        // Token invalid or server unreachable — kick back to login
        router.replace('./login');
      }
    };

    checkAccess();
  }, [moduleKey]);

  // --- MODULE TEMPLATE ROUTING ---
  useEffect(() => {
    const loadModuleTemplate = async () => {
      try {
        const UI_TYPES: Record<string, string> = {
          '1': 'block_coding',
          '2': 'live_video',
          '3': 'alphabet_recognition',
          '4': 'shortest_path',
          '5': 'swarm_routine',
        };
        setModuleData({
          id: moduleKey,
          title: `Module ${moduleKey}`,
          ui_type: UI_TYPES[moduleKey] ?? 'unsupported',
        });
      } catch {
        console.error("Failed to load module routing data");
      } finally {
        setLoading(false);
      }
    };

    loadModuleTemplate();
  }, [moduleKey]);

  // Waiting on either access check or module data
  if (loading || accessGranted === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Mission Environment...</Text>
      </View>
    );
  }

  // Module is locked — show a clear gate screen
  if (!accessGranted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Module Locked</Text>
        <Text style={styles.lockBody}>
          Complete the previous module in the TelloLearn web app to unlock this mission.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  switch (moduleData?.ui_type) {
    case 'block_coding':        return <Module1UI moduleData={moduleData} />;
    case 'live_video':          return <Module2UI moduleData={moduleData} />;
    case 'alphabet_recognition':return <Module3UI moduleData={moduleData} />;
    case 'shortest_path':       return <Module4UI moduleData={moduleData} />;
    case 'swarm_routine':       return <Module5UI moduleData={moduleData} />;
    default:
      return (
        <View style={styles.centered}>
          <Text style={{ color: 'white' }}>Unsupported Module: {moduleData?.ui_type}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 30,
  },
  loadingText: { color: 'white', marginTop: 10 },
  lockIcon: { fontSize: 56, marginBottom: 16 },
  lockTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  lockBody: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  backBtn: {
    marginTop: 32,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  backBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});
