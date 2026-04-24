import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { CloseIcon, CheckIcon } from '@/components/Icons';
import { C } from '@/constants/colors';
import Svg, { Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

type Stage = 'scan' | 'found' | 'done';

export default function PairScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addAgent = useStore(s => s.addAgent);

  const [stage, setStage] = useState<Stage>('scan');
  const [agentName, setAgentName] = useState('');
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage === 'scan') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      anim.start();
      const timer = setTimeout(() => {
        anim.stop();
        setStage('found');
      }, 3000);
      return () => { anim.stop(); clearTimeout(timer); };
    }
  }, [stage]);

  const scanY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-70, 70],
  });

  const handleDone = () => {
    const name = agentName.trim() || 'Betty Shellstein';
    addAgent(name, 'studio.local');
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <CloseIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Pair agent</Text>
        <Text style={styles.subtitle}>
          {stage === 'scan' && 'Point your camera at the QR code shown in OpenClaw on your machine.'}
          {stage === 'found' && 'Found a machine. Confirm the fingerprint matches.'}
          {stage === 'done' && 'Agent paired. Give them a name.'}
        </Text>
      </View>

      <View style={styles.content}>
        {stage === 'scan' && (
          <View style={styles.qrViewfinder}>
            {/* Corner brackets */}
            {[
              { top: 16, left: 16, rotate: '0deg' },
              { top: 16, right: 16, rotate: '90deg' },
              { bottom: 16, left: 16, rotate: '270deg' },
              { bottom: 16, right: 16, rotate: '180deg' },
            ].map((pos, i) => (
              <View
                key={i}
                style={[styles.corner, pos, { transform: [{ rotate: pos.rotate }] }]}
              />
            ))}

            {/* Scan line */}
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}
            />

            <Text style={styles.scanHint}>LOOKING FOR QR…</Text>
          </View>
        )}

        {stage === 'found' && (
          <View style={styles.foundCard}>
            <Text style={styles.foundLabel}>Machine</Text>
            <Text style={styles.foundHost}>studio.local</Text>
            <View style={styles.fingerprintBox}>
              <Text style={styles.fingerprintText}>fp: 4a:8f:e2:9c:b1:77:3d:28{'\n'}ed25519 · openclaw 0.4.2</Text>
            </View>
            <View style={styles.foundActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setStage('done')}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmText}>Confirm & pair</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setStage('scan')}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {stage === 'done' && (
          <View style={styles.doneCard}>
            <View style={styles.checkCircle}>
              <CheckIcon color={C.success} size={28} />
            </View>
            <Text style={styles.doneTitle}>Paired!</Text>
            <Text style={styles.doneSub}>Name this agent so you can find them later.</Text>
            <TextInput
              style={styles.nameInput}
              value={agentName}
              onChangeText={setAgentName}
              placeholder="Betty Shellstein"
              placeholderTextColor={C.muted}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity activeOpacity={0.8} onPress={handleDone} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OR divider + alternatives */}
        <Text style={styles.orDivider}>— OR —</Text>

        <View style={styles.alternativesCard}>
          <TouchableOpacity style={styles.altRow} activeOpacity={0.7}>
            <Text style={styles.altLabel}>Paste link</Text>
            <Text style={styles.altHint}>clawface://…</Text>
          </TouchableOpacity>
          <View style={styles.altDivider} />
          <TouchableOpacity style={styles.altRow} activeOpacity={0.7}>
            <Text style={styles.altLabel}>Enter code</Text>
            <Text style={styles.altHint}>_ _ _-_ _ _ _</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32, fontWeight: '700', color: C.ink,
    letterSpacing: -0.8, lineHeight: 36,
  },
  subtitle: {
    fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 0,
  },
  qrViewfinder: {
    aspectRatio: 1,
    backgroundColor: '#1A1815',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: C.accent,
    borderRadius: 2,
  },
  scanLine: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    height: 2,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  scanHint: {
    position: 'absolute',
    bottom: 20,
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
  },
  foundCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 0,
  },
  foundLabel: {
    fontSize: 11, color: C.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    fontFamily: 'Courier New',
  },
  foundHost: {
    fontSize: 22, fontWeight: '700', color: C.ink,
    letterSpacing: -0.5, marginTop: 4,
  },
  fingerprintBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: C.surface2,
    borderRadius: 12,
  },
  fingerprintText: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: C.ink2,
    lineHeight: 18,
  },
  foundActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  confirmBtn: {
    flex: 1, padding: 12, borderRadius: 12,
    backgroundColor: C.ink, alignItems: 'center',
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  cancelText: { color: C.ink2, fontSize: 15 },
  doneCard: {
    backgroundColor: C.surface,
    borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', gap: 0,
  },
  checkCircle: {
    width: 60, height: 60, borderRadius: 20,
    backgroundColor: C.successSoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  doneTitle: {
    fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.3,
  },
  doneSub: {
    fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 14, textAlign: 'center',
  },
  nameInput: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 15,
    backgroundColor: C.surface2,
    color: C.ink,
    marginBottom: 10,
  },
  doneBtn: {
    width: '100%', padding: 12, borderRadius: 12,
    backgroundColor: C.ink, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  orDivider: {
    textAlign: 'center',
    paddingVertical: 18,
    fontFamily: 'Courier New',
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
  },
  alternativesCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  altDivider: { height: 1, backgroundColor: C.border },
  altLabel: { flex: 1, fontSize: 14, color: C.ink },
  altHint: { fontSize: 12, color: C.muted, fontFamily: 'Courier New' },
});
