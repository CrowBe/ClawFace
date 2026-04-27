import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Avatar } from '@/components/Avatar';
import { Toast } from '@/components/Toast';
import { BackIcon } from '@/components/Icons';
import { deleteSessionKey } from '@/services/secureStore';
import { C } from '@/constants/colors';

export default function KeysScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const agents = useStore(s => s.agents);
  const removeAgent = useStore(s => s.removeAgent);

  const handleRevoke = (agentId: string, name: string) => {
    Alert.alert(
      `Revoke ${name}?`,
      'This deletes the session key from this device and removes the agent. The agent itself is unaffected — you can re-pair later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            deleteSessionKey(agentId).catch(() => {});
            removeAgent(agentId);
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.pageTitle}>Keys</Text>
        <Text style={styles.subtitle}>
          Per-agent session keys stored in the Android Keystore
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {agents.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No paired agents.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {agents.map((a, i) => (
              <View key={a.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Avatar agent={a} size={36} dot={a.online ? 'online' : 'offline'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{a.name}</Text>
                  <Text style={styles.host}>{a.host} · paired {a.paired}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleRevoke(a.id, a.name)}
                  style={styles.revokeBtn}
                >
                  <Text style={styles.revokeText}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  titleBlock: { paddingHorizontal: 20, paddingVertical: 4, paddingBottom: 12 },
  pageTitle: {
    fontSize: 32, fontWeight: '700', color: C.ink,
    letterSpacing: -0.8, lineHeight: 36,
  },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  name: { fontSize: 15, fontWeight: '600', color: C.ink },
  host: { fontSize: 12, color: C.muted, marginTop: 2, fontFamily: 'Courier New' },
  revokeBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1, borderColor: C.danger,
  },
  revokeText: { fontSize: 13, color: C.danger, fontWeight: '600' },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 14, color: C.muted },
});
