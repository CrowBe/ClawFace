import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { useStore } from '@/store';
import { Avatar } from './Avatar';
import { PlusIcon } from './Icons';
import { C } from '@/constants/colors';
import { useRouter } from 'expo-router';

export function Drawer() {
  const { agents, currentAgentId, showDrawer, toggleDrawer, setAgent, agentsWithPending } = useStore();
  const pendingSet = agentsWithPending();
  const router = useRouter();

  if (!showDrawer) return null;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={() => toggleDrawer(false)} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>Switch agent</Text>
          <Text style={styles.hint}>Tap to switch</Text>
        </View>

        {agents.map((a, i) => {
          const asking = pendingSet.has(a.id);
          const active = a.id === currentAgentId;
          return (
            <TouchableOpacity
              key={a.id}
              activeOpacity={0.7}
              onPress={() => {
                setAgent(a.id);
                router.push(`/threads/${a.id}`);
              }}
              style={[styles.agentRow, active && styles.agentRowActive]}
            >
              <Avatar
                agent={a}
                size={36}
                dot={asking ? 'ask' : a.online ? 'online' : 'offline'}
              />
              <View style={styles.agentInfo}>
                <View style={styles.agentNameRow}>
                  <Text style={styles.agentName}>{a.name}</Text>
                  {active && <Text style={styles.activePill}>● active</Text>}
                </View>
                <Text style={[styles.agentSub, asking && { color: C.accent }]}>
                  {asking ? 'needs approval' : `${a.role} · ${a.online ? 'online' : 'offline'}`}
                </Text>
              </View>
              <Text style={styles.kbd}>⌘{i + 1}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.divider} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { toggleDrawer(false); router.push('/pair'); }}
          style={styles.actionRow}
        >
          <View style={styles.actionIcon}>
            <PlusIcon color={C.ink2} size={18} />
          </View>
          <Text style={styles.actionLabel}>Pair new agent</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 200,
  },
  panel: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 210,
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 60,
    elevation: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  hint: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
  },
  agentRowActive: {
    backgroundColor: C.surface2,
  },
  agentInfo: {
    flex: 1,
    minWidth: 0,
  },
  agentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  activePill: {
    fontSize: 10,
    color: C.accent,
    fontWeight: '500',
  },
  agentSub: {
    fontSize: 11,
    color: C.muted,
    fontFamily: 'Courier New',
  },
  kbd: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: C.muted,
    backgroundColor: C.surface2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  divider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: C.border,
    marginTop: 8,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    color: C.ink,
    fontWeight: '500',
  },
});
