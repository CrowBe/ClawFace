import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { useStore } from '@/store';
import { setSessionKey } from '@/services/secureStore';
import { registerForPushNotifications } from '@/services/notifications';
import { wsTransport } from '@/services/transport';
import { CloseIcon, CheckIcon } from '@/components/Icons';
import { C } from '@/constants/colors';

interface PairingPayload {
  v: 1;
  host: string;
  port: number;
  fingerprint: string;
  code: string;
  name?: string;
  secure?: boolean;
}

function agentWsUrl(payload: PairingPayload, path: '/pair' | '/agent'): string {
  const protocol = payload.secure ? 'wss' : 'ws';
  return `${protocol}://${payload.host}:${payload.port}${path}`;
}

function parsePairingPayload(raw: string): PairingPayload | null {
  let str = raw.trim();
  if (str.startsWith('clawface://')) {
    str = Buffer.from(str.replace('clawface://', ''), 'base64').toString('utf8');
  }
  try {
    const obj = JSON.parse(str) as Record<string, unknown>;
    if (
      obj.v === 1 &&
      typeof obj.host === 'string' &&
      typeof obj.port === 'number' &&
      typeof obj.fingerprint === 'string' &&
      typeof obj.code === 'string'
    ) {
      return obj as unknown as PairingPayload;
    }
    return null;
  } catch {
    return null;
  }
}

type Stage = 'scan' | 'pairing' | 'done' | 'error';

export default function PairScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addAgent = useStore(s => s.addAgent);

  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('scan');
  const [agentName, setAgentName] = useState('');
  const [pairedAgentId, setPairedAgentId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [scanned, setScanned] = useState(false);

  const handlePayload = useCallback(async (raw: string) => {
    const payload = parsePairingPayload(raw);
    if (!payload) {
      setErrorMsg('Invalid QR payload. Expected JSON with v, host, port, fingerprint, code.');
      setStage('error');
      return;
    }

    setStage('pairing');

    try {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const clientKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      const ws = new WebSocket(agentWsUrl(payload, '/pair'));

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('Pairing handshake timed out'));
        }, 10000);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'pair', code: payload.code, clientKey }));
        };

        ws.onmessage = async (event) => {
          clearTimeout(timer);
          try {
            const msg = JSON.parse(event.data as string) as Record<string, unknown>;
            if (msg.type === 'session' && typeof msg.sessionKey === 'string') {
              const name = payload.name ?? agentName;
              const agent = addAgent(name || 'Agent', payload.host, msg.sessionKey, payload.port, payload.secure);
              await setSessionKey(agent.id, msg.sessionKey);
              wsTransport.setSessionKey(agent.id, msg.sessionKey);
              setPairedAgentId(agent.id);
              setAgentName(name || '');

              const pushToken = await registerForPushNotifications().catch(() => null);
              if (pushToken) {
                const agentWs = new WebSocket(agentWsUrl(payload, '/agent'));
                agentWs.onopen = () => {
                  agentWs.send(JSON.stringify({ type: 'hello', sessionKey: msg.sessionKey, clientVersion: '0.4.0' }));
                  agentWs.send(JSON.stringify({ type: 'register_push', token: pushToken }));
                  agentWs.close();
                };
              }

              ws.close();
              resolve();
            } else if (msg.type === 'error') {
              reject(new Error((msg.error as string) ?? 'Pairing rejected by server'));
            } else {
              reject(new Error('Unexpected server message during pairing'));
            }
          } catch (e) {
            reject(e);
          }
        };

        ws.onerror = () => reject(new Error('WebSocket connection failed'));
        ws.onclose = () => {};
      });

      setStage('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown pairing error';
      setErrorMsg(msg);
      setStage('error');
      setScanned(false);
    }
  }, [addAgent, agentName]);

  const handleBarcodeScan = useCallback(({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    handlePayload(data).catch(() => {});
  }, [scanned, handlePayload]);

  const handleDone = () => {
    router.back();
  };

  const handlePasteSubmit = () => {
    if (!pasteInput.trim()) return;
    handlePayload(pasteInput.trim()).catch(() => {});
  };

  const handleCodeSubmit = () => {
    if (!codeInput.trim()) return;
    Alert.alert('Enter full link', 'Please paste the full clawface:// link instead.');
  };

  if (!permission) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.subtitle}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
            <CloseIcon color={C.ink2} />
          </TouchableOpacity>
        </View>
        <View style={styles.permDenied}>
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.subtitle}>
            ClawFace needs camera access to scan QR codes. Please grant permission to continue.
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={requestPermission} style={styles.permBtn}>
            <Text style={styles.confirmText}>Grant camera access</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.orDivider}>— OR —</Text>
        <AlternativeInputs
          pasteInput={pasteInput}
          setPasteInput={setPasteInput}
          codeInput={codeInput}
          setCodeInput={setCodeInput}
          onPasteSubmit={handlePasteSubmit}
          onCodeSubmit={handleCodeSubmit}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <CloseIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Pair agent</Text>
        <Text style={styles.subtitle}>
          {stage === 'scan' && 'Point your camera at the QR code shown in OpenClaw on your machine.'}
          {stage === 'pairing' && 'Connecting to agent…'}
          {stage === 'done' && 'Agent paired successfully.'}
          {stage === 'error' && 'Pairing failed.'}
        </Text>
      </View>

      <View style={styles.content}>
        {(stage === 'scan' || stage === 'pairing') && (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={stage === 'scan' ? handleBarcodeScan : undefined}
            />
            {stage === 'pairing' && (
              <View style={styles.cameraOverlay}>
                <Text style={styles.pairingText}>Pairing…</Text>
              </View>
            )}
            {[
              { top: 16, left: 16, rotate: '0deg' },
              { top: 16, right: 16, rotate: '90deg' },
              { bottom: 16, left: 16, rotate: '270deg' },
              { bottom: 16, right: 16, rotate: '180deg' },
            ].map((pos, i) => (
              <View
                key={i}
                style={[styles.corner, pos as object, { transform: [{ rotate: pos.rotate }] }]}
              />
            ))}
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
              placeholder="Agent name"
              placeholderTextColor={C.muted}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity activeOpacity={0.8} onPress={handleDone} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not pair</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { setStage('scan'); setScanned(false); setErrorMsg(''); }}
              style={styles.confirmBtn}
            >
              <Text style={styles.confirmText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.orDivider}>— OR —</Text>

        <AlternativeInputs
          pasteInput={pasteInput}
          setPasteInput={setPasteInput}
          codeInput={codeInput}
          setCodeInput={setCodeInput}
          onPasteSubmit={handlePasteSubmit}
          onCodeSubmit={handleCodeSubmit}
        />
      </View>
    </View>
  );
}

function AlternativeInputs({
  pasteInput, setPasteInput, codeInput, setCodeInput, onPasteSubmit, onCodeSubmit,
}: {
  pasteInput: string;
  setPasteInput: (v: string) => void;
  codeInput: string;
  setCodeInput: (v: string) => void;
  onPasteSubmit: () => void;
  onCodeSubmit: () => void;
}) {
  return (
    <View style={styles.alternativesCard}>
      <View style={styles.altRow}>
        <TextInput
          style={styles.altInput}
          value={pasteInput}
          onChangeText={setPasteInput}
          placeholder="Paste clawface:// link or JSON"
          placeholderTextColor={C.muted}
          returnKeyType="go"
          onSubmitEditing={onPasteSubmit}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {pasteInput.length > 0 && (
          <TouchableOpacity activeOpacity={0.7} onPress={onPasteSubmit} style={styles.altSubmit}>
            <Text style={styles.altSubmitText}>Go</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.altDivider} />
      <View style={styles.altRow}>
        <TextInput
          style={styles.altInput}
          value={codeInput}
          onChangeText={setCodeInput}
          placeholder="Enter code  _ _ _-_ _ _ _"
          placeholderTextColor={C.muted}
          returnKeyType="go"
          onSubmitEditing={onCodeSubmit}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />
        {codeInput.length > 0 && (
          <TouchableOpacity activeOpacity={0.7} onPress={onCodeSubmit} style={styles.altSubmit}>
            <Text style={styles.altSubmitText}>Go</Text>
          </TouchableOpacity>
        )}
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
  },
  cameraWrap: {
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingText: {
    color: C.surface,
    fontSize: 16,
    fontWeight: '600',
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
  permDenied: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  permBtn: {
    padding: 12, borderRadius: 12,
    backgroundColor: C.ink, alignItems: 'center',
    marginTop: 8,
  },
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
  doneBtnText: { color: C.surface, fontSize: 15, fontWeight: '600' },
  errorCard: {
    backgroundColor: C.surface,
    borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: C.danger,
    gap: 10,
  },
  errorTitle: {
    fontSize: 18, fontWeight: '700', color: C.danger,
  },
  errorMsg: {
    fontSize: 13, color: C.ink2, lineHeight: 18,
  },
  confirmBtn: {
    padding: 12, borderRadius: 12,
    backgroundColor: C.ink, alignItems: 'center',
  },
  confirmText: { color: C.surface, fontSize: 15, fontWeight: '600' },
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
    paddingVertical: 4,
  },
  altInput: {
    flex: 1,
    fontSize: 14,
    color: C.ink,
    paddingVertical: 10,
  },
  altDivider: { height: 1, backgroundColor: C.border },
  altSubmit: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  altSubmitText: { fontSize: 13, fontWeight: '600', color: C.accent },
});
