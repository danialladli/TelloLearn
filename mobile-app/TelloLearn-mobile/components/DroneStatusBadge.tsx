import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import axios from 'axios';

type DroneStatus = 'checking' | 'connected' | 'disconnected';

export default function DroneStatusBadge() {
  const [status, setStatus] = useState<DroneStatus>('checking');

  const poll = useCallback(async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) { setStatus('disconnected'); return; }
      const res = await axios.get(`${apiUrl}/drone/status`, { timeout: 3000 });
      setStatus(res.data.error ? 'disconnected' : 'connected');
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  const connected = status === 'connected';
  const checking = status === 'checking';

  const color = connected ? '#10b981' : checking ? '#94a3b8' : '#ef4444';
  const bg = connected
    ? 'rgba(16,185,129,0.12)'
    : checking
    ? 'rgba(148,163,184,0.12)'
    : 'rgba(239,68,68,0.12)';
  const label = checking
    ? 'Checking...'
    : connected
    ? 'Drone: Connected'
    : 'Drone: Not Connected';

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
