import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Avatar } from '@/components/Avatar';
import { Toggle } from '@/components/Toggle';
import { BackIcon, ChevronRightIcon } from '@/components/Icons';
import { C } from '@/constants/colors';
import type { PermValue } from '@/data/seed';

export default function ConfigScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();

  const agents = useStore(s => s.agents);
  const setAgentPerm = useStore(s => s.setAgentPerm);
  const setAgentFolders = useStore(s => s.setAgentFolders);

  const agent = agents.find(a => a.id === agentId);
  if (!agent) return null;

  const togglePerm = (key: string, current: PermValue) => {
    const next: PermValue = current === false ? 'ask' : current === 'ask' ? true : false;
    setAgentPerm(agentId, key, next);
  };

  const permLabel = (v: PermValue) =>
    v === true ? 'Always' : v === 'ask' ? 'Ask each time' : 'Never';

  const permColor = (v: PermValue) =>
    v === true ? C.success : v === 'ask' ? C.warn : C.danger;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      {/* Agent identity */}
      <View style={styles.agentHeader}>
        <Avatar agent={agent} size={56} dot={agent.online ? 'online' : 'offline'} />
        <View>
          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agentHost}>{agent.host} · paired {agent.paired}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <Group title="Identity">
          <Row label="Nickname" value={agent.name} chevron />
          <Row
            label="Avatar color"
            value={<View style={[styles.colorSwatch, { backgroundColor: agent.tint }]} />}
            chevron
          />
          <Row label="Status" value={agent.online ? 'Online' : 'Offline'} />
        </Group>

        {/* Permissions */}
        <Group title="Permissions">
          {(['read', 'write', 'shell', 'network'] as const).map(key => {
            const v = agent.perms[key];
            return (
              <View key={key} style={styles.permRow}>
                <Text style={styles.rowLabel}>
                  {key === 'read' ? 'Read files' :
                   key === 'write' ? 'Write files' :
                   key === 'shell' ? 'Run shell' : 'Network'}
                </Text>
                <View style={styles.permRight}>
                  {v === 'ask' && (
                    <View style={styles.askBadge}>
                      <Text style={styles.askBadgeText}>ask each</Text>
                    </View>
                  )}
                  <Toggle
                    value={v !== false}
                    onChange={() => togglePerm(key, v)}
                  />
                </View>
              </View>
            );
          })}
        </Group>

        {/* Notifications */}
        <Group title="Notifications">
          <Row label="Approval requests" value={agent.notifs.approvals} chevron />
          <Row label="Completions" value={agent.notifs.completions} chevron />
          <Row label="Quiet hours" value="10p–8a" chevron />
        </Group>

        {/* Thread display */}
        <Group title="Threads">
          <View style={styles.permRow}>
            <Text style={styles.rowLabel}>Group by folder</Text>
            <Toggle
              value={agent.folders}
              onChange={(v) => setAgentFolders(agentId, v)}
            />
          </View>
        </Group>

        {/* Danger zone */}
        <TouchableOpacity activeOpacity={0.7} style={styles.unpairBtn}>
          <Text style={styles.unpairText}>Unpair agent</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={groupStyles.container}>
      <Text style={groupStyles.title}>{title}</Text>
      <View style={groupStyles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value, chevron }: {
  label: string;
  value: React.ReactNode;
  chevron?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.right}>
        {typeof value === 'string' ? (
          <Text style={rowStyles.value}>{value}</Text>
        ) : value}
        {chevron && <ChevronRightIcon color={C.muted} />}
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
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  agentName: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  agentHost: { fontSize: 12, color: C.muted, fontFamily: 'Courier New', marginTop: 2 },
  scroll: { paddingBottom: 40 },
  colorSwatch: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1, borderColor: C.border,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
  },
  rowLabel: { flex: 1, fontSize: 14, color: C.ink },
  permRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  askBadge: {
    backgroundColor: C.warnSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  askBadgeText: { fontSize: 11, color: C.warn, fontWeight: '500' },
  unpairBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.danger,
    alignItems: 'center',
  },
  unpairText: { fontSize: 14, color: C.danger, fontWeight: '500' },
});

const groupStyles = StyleSheet.create({
  container: { marginTop: 12 },
  title: {
    fontSize: 11, color: C.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    fontFamily: 'Courier New',
    paddingHorizontal: 28, paddingBottom: 6,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 10,
  },
  label: { flex: 1, fontSize: 14, color: C.ink },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontSize: 13, color: C.muted },
});
