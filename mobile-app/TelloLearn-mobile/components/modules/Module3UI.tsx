import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { XCircle, Play, Square, AlertOctagon, Type, ScanLine } from 'lucide-react-native';
import axios from 'axios';
import DroneStatusBadge from '@/components/DroneStatusBadge';
import { checkDroneConnected } from '@/utils/droneCheck';
import { useApiUrl } from '@/utils/apiConfig';

export default function Module3UI({ moduleData }: { moduleData: any }) {
  const { apiUrl: API_URL } = useApiUrl();
  const router = useRouter();

  // ── Mission state ────────────────────────────────────────────────────────
  const [missionActive, setMissionActive]   = useState(false);
  const [countdown, setCountdown]           = useState<number | null>(null);
  const [targetWord, setTargetWord]         = useState('');

  // ── Telemetry ────────────────────────────────────────────────────────────
  const [flightState, setFlightState]       = useState('OFFLINE');
  const [currentTarget, setCurrentTarget]   = useState('');
  const [spelledCount, setSpelledCount]     = useState(0);
  const [lettersFound, setLettersFound]     = useState<string[]>([]);
  const [scanComplete, setScanComplete]     = useState(false);
  const [distances, setDistances]           = useState<(number | null)[]>([]);
  const [liveWord, setLiveWord]             = useState('');  // word returned by backend

  // ── Video snapshot ───────────────────────────────────────────────────────
  const [frameUri, setFrameUri]             = useState(`${API_URL}/video/snapshot?t=0`);

  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasEverActive  = useRef(false);

  // Snapshot poll — 100 ms
  useEffect(() => {
    const id = setInterval(() => {
      setFrameUri(`${API_URL}/video/snapshot?t=${Date.now()}`);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Telemetry poll ───────────────────────────────────────────────────────
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;

    if (missionActive) {
      id = setInterval(async () => {
        try {
          const { data } = await axios.get(`${API_URL}/api/module3/telemetry`);
          setFlightState(data.state);
          setCurrentTarget(data.current_target);
          setSpelledCount(data.spelled_count);
          setLettersFound(data.letters_found ?? []);
          setScanComplete(data.scan_complete ?? false);
          setDistances(data.distances ?? []);
          setLiveWord(data.full_word ?? targetWord.toUpperCase());

          if (data.status === 'active') {
            wasEverActive.current = true;
          } else if (data.status === 'inactive' && wasEverActive.current) {
            wasEverActive.current = false;
            setMissionActive(false);
            if (data.state === 'MISSION_COMPLETE') {
              Alert.alert('Mission Complete!', `Drone spelled: ${data.full_word}`);
            }
          }
        } catch {
          // network hiccup — ignore
        }
      }, 500);
    } else {
      if (flightState !== 'MISSION_COMPLETE') setFlightState('OFFLINE');
    }

    return () => clearInterval(id);
  }, [missionActive]);

  // ── Mission start ────────────────────────────────────────────────────────
  const toggleMission = async () => {
    if (countdown !== null) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }
    if (missionActive) {
      setMissionActive(false);
      axios.post(`${API_URL}/api/module1/land`).catch(() => {});
      return;
    }
    if (!targetWord.trim()) {
      Alert.alert('Input Required', 'Enter a word for the drone to spell.');
      return;
    }
    if (!await checkDroneConnected(API_URL)) return;

    let count = 3;
    setCountdown(count);
    setSpelledCount(0);
    setLettersFound([]);
    setScanComplete(false);
    setDistances([]);
    setLiveWord(targetWord.toUpperCase());

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
          await axios.post(`${API_URL}/api/module3/start`, { word: targetWord.toUpperCase() });
          setMissionActive(true);
        } catch {
          Alert.alert('Error', 'Could not start mission. Check drone connection.');
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
      await axios.post(`${API_URL}/api/module1/land`);
      Alert.alert('Emergency Land', 'Drone is landing safely.');
    } catch {
      Alert.alert('Error', 'Failed to send land command.');
    }
  };

  // ── Derived UI ───────────────────────────────────────────────────────────
  const word = liveWord || targetWord.toUpperCase();

  const stateColor = (s: string) => {
    if (s === 'SCANNING')  return '#f59e0b';
    if (s === 'ROTATING')  return '#3b82f6';
    if (s === 'ALIGNING')  return '#a78bfa';
    if (s === 'HOVERING')  return '#10b981';
    if (s === 'MISSION_COMPLETE') return '#10b981';
    if (s === 'CALCULATING') return '#f59e0b';
    return '#94a3b8';
  };

  const btnUI = (() => {
    if (countdown !== null)
      return { text: 'CANCEL COUNTDOWN', color: '#f59e0b', icon: <Square fill="white" color="white" size={22} /> };
    if (missionActive)
      return { text: 'STOP MISSION', color: '#ef4444', icon: <Square fill="white" color="white" size={22} /> };
    return { text: 'START MISSION', color: '#3b82f6', icon: <Play fill="white" color="white" size={22} /> };
  })();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <View style={styles.leftPanel}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); router.back(); }}>
              <XCircle color="#ef4444" size={30} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{moduleData?.title ?? 'Alphabet Hovering'}</Text>
            <DroneStatusBadge />
          </View>

          {/* Word input */}
          <View style={styles.inputRow}>
            <Type color="#3b82f6" size={18} />
            <TextInput
              style={styles.input}
              placeholder="Enter word (e.g. HELLO)"
              placeholderTextColor="#475569"
              value={targetWord}
              onChangeText={setTargetWord}
              autoCapitalize="characters"
              maxLength={8}
              editable={!missionActive && countdown === null}
            />
          </View>

          {/* Word tile progress */}
          {word.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WORD PROGRESS</Text>
              <View style={styles.wordTiles}>
                {word.split('').map((letter, i) => {
                  const done    = i < spelledCount;
                  const current = !done && letter === currentTarget && missionActive;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.tile,
                        done    ? styles.tileDone    : null,
                        current ? styles.tileCurrent : null,
                      ]}
                    >
                      <Text style={[styles.tileLetter, done ? { color: '#10b981' } : current ? { color: '#f59e0b' } : {}]}>
                        {letter}
                      </Text>
                      {done && <Text style={styles.tileTick}>✓</Text>}
                    </View>
                  );
                })}
              </View>

              {/* Distances row */}
              {distances.length > 0 && (
                <View style={styles.distRow}>
                  {word.split('').map((letter, i) => (
                    <React.Fragment key={i}>
                      <Text style={styles.distLetter}>{letter}</Text>
                      {i < distances.length && distances[i] != null && (
                        <Text style={styles.distArrow}>
                          {`${distances[i]! > 0 ? '+' : ''}${distances[i]!.toFixed(0)}°→`}
                        </Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Scan status */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <ScanLine color="#94a3b8" size={14} />
              <Text style={styles.sectionLabel}>WALL SCAN</Text>
              {scanComplete && <Text style={styles.badge}>DONE</Text>}
            </View>
            {lettersFound.length > 0 ? (
              <View style={styles.chipRow}>
                {lettersFound.map(l => (
                  <View key={l} style={[styles.chip, word.includes(l) ? styles.chipHighlight : null]}>
                    <Text style={[styles.chipText, word.includes(l) ? { color: '#10b981' } : {}]}>{l}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.dimText}>
                {missionActive && flightState === 'SCANNING' ? 'Scanning…' : 'No letters mapped yet'}
              </Text>
            )}
          </View>

          {/* State */}
          <View style={styles.stateRow}>
            <View style={[styles.stateDot, { backgroundColor: stateColor(flightState) }]} />
            <Text style={[styles.stateText, { color: stateColor(flightState) }]}>{flightState}</Text>
            {currentTarget ? (
              <Text style={styles.targetText}>  →  <Text style={{ color: '#f59e0b', fontWeight: '900' }}>{currentTarget}</Text></Text>
            ) : null}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: btnUI.color }]} onPress={toggleMission}>
              {btnUI.icon}
              <Text style={styles.btnText}>{btnUI.text}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={emergencyLand}>
              <AlertOctagon color="white" size={22} />
              <Text style={styles.btnText}>EMERGENCY LAND</Text>
            </TouchableOpacity>
          </View>
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

          {/* HUD */}
          <View style={styles.hud}>
            <Text style={styles.hudText}>● LIVE</Text>
          </View>

          {/* Countdown overlay */}
          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownNum}>{countdown}</Text>
              <Text style={styles.countdownSub}>STAND CLEAR — TAKEOFF</Text>
            </View>
          )}

          {/* State chip on video */}
          {missionActive && (
            <View style={[styles.stateChip, { borderColor: stateColor(flightState) }]}>
              <Text style={[styles.stateChipText, { color: stateColor(flightState) }]}>
                {flightState}{currentTarget ? `  ${currentTarget}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' },

  // Left panel
  leftPanel:  { flex: 0.35, backgroundColor: '#1e293b', borderRightWidth: 2, borderColor: '#334155' },
  scroll:     { padding: 18, paddingBottom: 30 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  title:      { flex: 1, color: 'white', fontSize: 17, fontWeight: 'bold' },

  // Input
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', borderWidth: 1.5, borderColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 14, marginBottom: 18 },
  input:      { flex: 1, color: 'white', fontSize: 20, fontWeight: 'bold', paddingVertical: 12, letterSpacing: 3 },

  // Section
  section:    { marginBottom: 16 },
  sectionLabel:    { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  badge:      { backgroundColor: '#10b981', color: 'white', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  // Word tiles
  wordTiles:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tile:       { width: 38, height: 46, backgroundColor: '#0f172a', borderWidth: 1.5, borderColor: '#334155', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileDone:   { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' },
  tileCurrent:{ borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' },
  tileLetter: { color: '#94a3b8', fontSize: 18, fontWeight: '900' },
  tileTick:   { color: '#10b981', fontSize: 9, position: 'absolute', top: 2, right: 4 },

  // Distances
  distRow:    { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2, marginTop: 4 },
  distLetter: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  distArrow:  { color: '#3b82f6', fontSize: 10, marginHorizontal: 1 },

  // Scan chips
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:       { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipHighlight: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)' },
  chipText:   { color: '#64748b', fontSize: 13, fontWeight: '700' },
  dimText:    { color: '#475569', fontSize: 13 },

  // State row
  stateRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stateDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  stateText:  { fontSize: 14, fontWeight: '700' },
  targetText: { color: '#94a3b8', fontSize: 14 },

  // Buttons
  buttons:    { gap: 12 },
  mainBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 10 },
  dangerBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 10, backgroundColor: '#ef4444' },
  btnText:    { color: 'white', fontWeight: 'bold', fontSize: 15 },

  // Right panel / video
  rightPanel: { flex: 0.65, padding: 18, justifyContent: 'center', alignItems: 'center' },
  videoBox:   { width: '100%', height: '100%', backgroundColor: '#000', borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#334155', position: 'relative' },
  video:      { width: '100%', height: '100%' },
  hud:        { position: 'absolute', top: 16, left: 16, backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#ef4444' },
  hudText:    { color: '#ef4444', fontWeight: 'bold', letterSpacing: 1, fontSize: 12 },

  stateChip:  { position: 'absolute', bottom: 16, left: 16, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
  stateChipText: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  countdownNum:     { color: '#3b82f6', fontSize: 110, fontWeight: '900' },
  countdownSub:     { color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, marginTop: 8 },
});
