import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  XCircle, Play, Square, AlertOctagon,
  ChevronDown, ChevronUp, Wifi,
  ArrowUp, ArrowDown,
  RotateCcw, RotateCw, PlaneLanding,
} from 'lucide-react-native';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { checkDroneConnected } from '@/utils/droneCheck';
import { useApiUrl } from '@/utils/apiConfig';

// Must match ROUTINE_STEPS order in module5_logic.py
const ROUTINE_STEPS = [
  { label: 'Move Forward 50 cm',       icon: <ArrowUp    color="#94a3b8" size={16} /> },
  { label: 'Move Backward 50 cm',      icon: <ArrowDown  color="#94a3b8" size={16} /> },
  { label: 'Rotate Clockwise 90°',     icon: <RotateCw   color="#94a3b8" size={16} /> },
  { label: 'Rotate Anticlockwise 90°', icon: <RotateCcw  color="#94a3b8" size={16} /> },
  { label: 'Move Up 30 cm',            icon: <ArrowUp    color="#94a3b8" size={16} /> },
  { label: 'Move Down 30 cm',          icon: <ArrowDown  color="#94a3b8" size={16} /> },
  { label: 'Land',                     icon: <PlaneLanding color="#94a3b8" size={16} /> },
];

export default function Module5UI({ moduleData }: { moduleData: any }) {
  const { apiUrl: API_URL } = useApiUrl();
  const router = useRouter();

  // ── Mission state ────────────────────────────────────────────────────────
  const [missionActive, setMissionActive] = useState(false);
  const [countdown, setCountdown]         = useState<number | null>(null);

  // ── Telemetry ────────────────────────────────────────────────────────────
  const [swarmState, setSwarmState]       = useState('IDLE');
  const [currentStep, setCurrentStep]     = useState(-1);
  const [droneCount, setDroneCount]       = useState(1);

  // ── Video ────────────────────────────────────────────────────────────────
  const [frameUri, setFrameUri]           = useState(`${API_URL}/video/snapshot?t=0`);

  // ── Setup guide ──────────────────────────────────────────────────────────
  const [guideOpen, setGuideOpen]         = useState(false);

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasEverActive = useRef(false);

  // Snapshot poll
  useEffect(() => {
    const id = setInterval(() => {
      setFrameUri(`${API_URL}/video/snapshot?t=${Date.now()}`);
    }, 100);
    return () => clearInterval(id);
  }, [API_URL]);

  // Telemetry poll
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    if (missionActive) {
      id = setInterval(async () => {
        try {
          const { data } = await axios.get(`${API_URL}/api/module5/telemetry`);
          setSwarmState(data.state);
          setCurrentStep(data.current_step ?? -1);
          setDroneCount(data.drone_count ?? 1);

          if (data.status === 'active') {
            wasEverActive.current = true;
          } else if (data.status === 'inactive' && wasEverActive.current) {
            wasEverActive.current = false;
            setMissionActive(false);
            if (data.state === 'COMPLETE') {
              Alert.alert('Routine Complete!', 'The drone completed all movements and landed.');
            } else if (data.state === 'ERROR') {
              Alert.alert('Routine Error', 'A step failed. Check the backend logs.');
            }
          }
        } catch {
          // network hiccup
        }
      }, 500);
    } else {
      if (swarmState !== 'COMPLETE') setSwarmState('IDLE');
    }
    return () => clearInterval(id);
  }, [missionActive]);

  // ── Start / Stop ─────────────────────────────────────────────────────────
  const toggleMission = async () => {
    if (countdown !== null) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }
    if (missionActive) {
      setMissionActive(false);
      axios.post(`${API_URL}/api/module5/stop`).catch(() => {});
      axios.post(`${API_URL}/api/module1/land`).catch(() => {});
      return;
    }

    if (!await checkDroneConnected(API_URL)) return;

    let count = 3;
    setCountdown(count);
    setCurrentStep(-1);
    setSwarmState('IDLE');

    timerRef.current = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        wasEverActive.current = false;
        try {
          await axios.post(`${API_URL}/api/module1/takeoff`);
          const res = await axios.post(`${API_URL}/api/module5/start`);
          if (res.data?.status === 'error' || res.data?.error) {
            Alert.alert('Module 5 Error', res.data.message ?? res.data.error);
            await axios.post(`${API_URL}/api/module1/land`).catch(() => {});
            setMissionActive(false);
            return;
          }
          setMissionActive(true);
        } catch {
          Alert.alert('Error', 'Could not start routine. Check drone connection.');
          setMissionActive(false);
        }
      }
    }, 1000);
  };

  const emergencyLand = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
    setMissionActive(false);
    axios.post(`${API_URL}/api/module5/stop`).catch(() => {});
    try {
      await axios.post(`${API_URL}/api/module1/land`);
      Alert.alert('Emergency Land', 'Drone is landing safely.');
    } catch {
      Alert.alert('Error', 'Failed to send land command.');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const stateColor = () => {
    if (swarmState === 'RUNNING')  return '#3b82f6';
    if (swarmState === 'COMPLETE') return '#10b981';
    if (swarmState === 'ERROR')    return '#ef4444';
    if (swarmState === 'STOPPED')  return '#f59e0b';
    return '#94a3b8';
  };

  const btnUI = (() => {
    if (countdown !== null)
      return { text: 'CANCEL COUNTDOWN', color: '#f59e0b', icon: <Square fill="white" color="white" size={20} /> };
    if (missionActive)
      return { text: 'STOP ROUTINE',     color: '#ef4444', icon: <Square fill="white" color="white" size={20} /> };
    return   { text: 'START ROUTINE',    color: '#3b82f6', icon: <Play   fill="white" color="white" size={20} /> };
  })();

  return (
    <View style={styles.container}>
      {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
      <View style={styles.leftPanel}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); router.back(); }}>
              <XCircle color="#ef4444" size={30} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{moduleData?.title ?? 'Swarm Programming'}</Text>
            <DroneStatusBadge />
          </View>

          {/* Drone count + state */}
          <View style={styles.statusRow}>
            <View style={styles.droneCountBadge}>
              <Text style={styles.droneCountText}>🚁 {droneCount} Drone{droneCount > 1 ? 's' : ''}</Text>
            </View>
            <View style={[styles.stateBadge, { borderColor: stateColor() }]}>
              <View style={[styles.stateDot, { backgroundColor: stateColor() }]} />
              <Text style={[styles.stateText, { color: stateColor() }]}>{swarmState}</Text>
            </View>
          </View>

          {/* Step list */}
          <Text style={styles.sectionLabel}>ROUTINE STEPS</Text>
          <View style={styles.stepList}>
            {ROUTINE_STEPS.map((step, i) => {
              const done    = currentStep > i || swarmState === 'COMPLETE';
              const active  = currentStep === i && missionActive;
              const pending = !done && !active;
              return (
                <View
                  key={i}
                  style={[
                    styles.stepRow,
                    done   ? styles.stepDone   : null,
                    active ? styles.stepActive : null,
                  ]}
                >
                  {/* Index bubble */}
                  <View style={[styles.stepBubble,
                    done   ? styles.bubbleDone   : null,
                    active ? styles.bubbleActive : null,
                  ]}>
                    <Text style={[styles.stepNum,
                      done   ? { color: '#10b981' } : null,
                      active ? { color: '#3b82f6' } : null,
                    ]}>
                      {done ? '✓' : i + 1}
                    </Text>
                  </View>

                  {/* Icon */}
                  <View style={{ opacity: pending ? 0.4 : 1 }}>{step.icon}</View>

                  {/* Label */}
                  <Text style={[styles.stepLabel,
                    done   ? { color: '#10b981' } : null,
                    active ? { color: '#3b82f6', fontWeight: '700' } : null,
                  ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: btnUI.color }]} onPress={toggleMission}>
              {btnUI.icon}
              <Text style={styles.btnText}>{btnUI.text}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={emergencyLand}>
              <AlertOctagon color="white" size={20} />
              <Text style={styles.btnText}>EMERGENCY LAND</Text>
            </TouchableOpacity>
          </View>

          {/* Setup guide (collapsible) */}
          <TouchableOpacity style={styles.guideHeader} onPress={() => setGuideOpen(v => !v)}>
            <Wifi color="#3b82f6" size={16} />
            <Text style={styles.guideHeaderText}>Connection Setup Guide</Text>
            {guideOpen ? <ChevronUp color="#64748b" size={16} /> : <ChevronDown color="#64748b" size={16} />}
          </TouchableOpacity>

          {guideOpen && (
            <View style={styles.guideBody}>
              <Text style={styles.guideTitle}>Single Drone (Current)</Text>
              {[
                '1. Power on the Tello — blink slowly = ready',
                '2. On your laptop: connect WiFi to "TELLO-XXXXXX"',
                '3. Wait ~10 s for the network to stabilise',
                '4. Start backend: uvicorn main:app --host 0.0.0.0 --port 8000',
                '5. Drone badge turns green → ready to fly',
              ].map((line, i) => (
                <Text key={i} style={styles.guideLine}>{line}</Text>
              ))}

              <Text style={[styles.guideTitle, { marginTop: 14 }]}>Two Drones (Future Swarm)</Text>
              {[
                '1. Get a WiFi router all devices share',
                '2. Connect laptop + both Tellos to that router',
                '3. Update TELLO_IP values in backend config per drone IP',
                '4. Backend auto-connects both → routine runs on 2 drones in sync',
              ].map((line, i) => (
                <Text key={i} style={styles.guideLine}>{line}</Text>
              ))}
            </View>
          )}

        </ScrollView>
      </View>

      {/* ── RIGHT PANEL: live video ──────────────────────────────────────── */}
      <View style={styles.rightPanel}>
        <View style={styles.videoBox}>
          <Image
            source={{ uri: frameUri }}
            style={styles.video}
            contentFit="contain"
            cachePolicy="none"
          />

          <View style={styles.hud}>
            <Text style={styles.hudText}>● LIVE</Text>
          </View>

          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownNum}>{countdown}</Text>
              <Text style={styles.countdownSub}>STAND CLEAR — TAKEOFF</Text>
            </View>
          )}

          {missionActive && currentStep >= 0 && (
            <View style={[styles.stepChip, { borderColor: stateColor() }]}>
              <Text style={[styles.stepChipText, { color: stateColor() }]}>
                {`Step ${currentStep + 1}/${ROUTINE_STEPS.length}  ${ROUTINE_STEPS[currentStep]?.label ?? ''}`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' },

  // Left
  leftPanel:  { flex: 0.35, backgroundColor: '#1e293b', borderRightWidth: 2, borderColor: '#334155' },
  scroll:     { padding: 18, paddingBottom: 30 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title:      { flex: 1, color: 'white', fontSize: 17, fontWeight: 'bold' },

  // Status row
  statusRow:      { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 },
  droneCountBadge:{ backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#334155' },
  droneCountText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  stateBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stateDot:       { width: 8, height: 8, borderRadius: 4 },
  stateText:      { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Step list
  sectionLabel: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  stepList:     { gap: 6, marginBottom: 22 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#1e293b' },
  stepDone:     { borderColor: 'rgba(16,185,129,0.25)', backgroundColor: 'rgba(16,185,129,0.05)' },
  stepActive:   { borderColor: 'rgba(59,130,246,0.5)',  backgroundColor: 'rgba(59,130,246,0.08)' },
  stepBubble:   { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  bubbleDone:   { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)' },
  bubbleActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
  stepNum:      { color: '#64748b', fontSize: 11, fontWeight: '700' },
  stepLabel:    { color: '#94a3b8', fontSize: 13, flex: 1 },

  // Buttons
  buttons:  { gap: 10, marginBottom: 20 },
  mainBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 10 },
  dangerBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 10, backgroundColor: '#ef4444' },
  btnText:  { color: 'white', fontWeight: 'bold', fontSize: 14 },

  // Setup guide
  guideHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderColor: '#334155' },
  guideHeaderText: { flex: 1, color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  guideBody:       { backgroundColor: '#0f172a', borderRadius: 10, padding: 14, gap: 6 },
  guideTitle:      { color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  guideLine:       { color: '#64748b', fontSize: 12, lineHeight: 18 },

  // Right / video
  rightPanel: { flex: 0.65, padding: 18, justifyContent: 'center', alignItems: 'center' },
  videoBox:   { width: '100%', height: '100%', backgroundColor: '#000', borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#334155', position: 'relative' },
  video:      { width: '100%', height: '100%' },
  hud:        { position: 'absolute', top: 16, left: 16, backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#ef4444' },
  hudText:    { color: '#ef4444', fontWeight: 'bold', letterSpacing: 1, fontSize: 12 },

  stepChip:     { position: 'absolute', bottom: 16, left: 16, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.65)' },
  stepChipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  countdownNum:     { color: '#3b82f6', fontSize: 110, fontWeight: '900' },
  countdownSub:     { color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginTop: 8 },
});
