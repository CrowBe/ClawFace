import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Avatar } from '@/components/Avatar';
import { Drawer } from '@/components/Drawer';
import { Toast } from '@/components/Toast';
import { MenuIcon, PlusIcon, ChevronRightIcon } from '@/components/Icons';
import { C } from '@/constants/colors';

function TabBar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const router = useRouter();
  const agentsWithPending = useStore(s => s.agentsWithPending());
  const pendingCount = useStore(s => s.pendingCount());

  const tabs = [
    { id: 'agents', label: 'Agents', badge: agentsWithPending.size || null },
    { id: 'alerts', label: 'Alerts', badge: pendingCount || null },
    { id: 'me', label: 'Me', badge: null },
  ];

  return (
    <View style={tabStyles.bar}>
      {tabs.map(t => {
        const active = tab === t.id;
        const color = active ? C.ink : C.muted;
        return (
          <TouchableOpacity
            key={t.id}
            activeOpacity={0.7}
            onPress={() => {
              if (t.id === 'alerts') router.push('/alerts');
              else if (t.id === 'me') router.push('/me');
              else setTab(t.id);
            }}
            style={tabStyles.tab}
          >
            <View style={{ position: 'relative' }}>
              {t.id === 'agents' && <AgentsTabIcon color={color} />}
              {t.id === 'alerts' && <BellTabIcon color={color} />}
              {t.id === 'me' && <PersonTabIcon color={color} />}
              {t.badge != null && (
                <View style={tabStyles.badge}>
                  <Text style={tabStyles.badgeText}>{t.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[tabStyles.label, { color, fontWeight: active ? '600' : '500' }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

import Svg, { Path, Circle } from 'react-native-svg';
function AgentsTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 20c0-4 3-6 7-6s7 2 7 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="17" cy="9" r="3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 20c0-3-2-5-5-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function BellTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9a6 6 0 0 1 12 0v4l1.5 3h-15L6 13z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PersonTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'rgba(250,247,240,0.92)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(60,60,67,0.12)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    backgroundColor: C.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

// ── Agents Screen ─────────────────────────────────────────────────────────────

export default function AgentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agents, threads, toggleDrawer, setAgent, agentsWithPending, pendingCount, showDrawer } = useStore();
  const [tab, setTab] = useState('agents');
  const [inboxSeen, setInboxSeen] = useState(false);
  const [agentsView, setAgentsView] = useState<'agents' | 'inbox'>('agents');

  const pendingSet = agentsWithPending();
  const asks = pendingCount();

  const handleViewChange = (v: 'agents' | 'inbox') => {
    setAgentsView(v);
    if (v === 'inbox') setInboxSeen(true);
  };

  // Build inbox items from threads with pending approvals + unread
  const inboxItems = threads.filter(t => {
    const hasPending = t.messages.some(m => m.role === 'approval' && m.status === 'pending');
    return hasPending || t.unread > 0;
  });

  const showToggle = !inboxSeen || asks > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => toggleDrawer()} style={styles.navBtn}>
          <MenuIcon color={C.ink2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/pair')} style={styles.navBtn}>
          <PlusIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      {/* Large title */}
      <View style={styles.titleBlock}>
        <Text style={styles.pageTitle}>Agents</Text>
        <Text style={styles.subtitle}>
          {agents.filter(a => a.online).length} online · {asks} waiting on you
        </Text>
      </View>

      {/* Segmented toggle: Agents | Inbox */}
      {showToggle && (
        <View style={styles.segmentWrap}>
          <View style={styles.segment}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleViewChange('agents')}
              style={[styles.segBtn, agentsView === 'agents' && styles.segBtnActive]}
            >
              <Text style={[styles.segText, agentsView === 'agents' && styles.segTextActive]}>
                Agents
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleViewChange('inbox')}
              style={[styles.segBtn, agentsView === 'inbox' && styles.segBtnActive]}
            >
              <Text style={[styles.segText, agentsView === 'inbox' && styles.segTextActive]}>
                Inbox
              </Text>
              {asks > 0 && (
                <View style={styles.inboxBadge}>
                  <Text style={styles.inboxBadgeText}>{asks}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {agentsView === 'agents' ? (
          <AgentList agents={agents} threads={threads} pendingSet={pendingSet} />
        ) : (
          <InboxList items={inboxItems} agents={agents} />
        )}
      </ScrollView>

      <TabBar tab="agents" setTab={setTab} />
      <View style={{ height: insets.bottom }} />

      {showDrawer && <Drawer />}
      <Toast />
    </View>
  );
}

function AgentList({ agents, threads, pendingSet }: any) {
  const router = useRouter();
  const { setAgent } = useStore();

  return (
    <View style={styles.card}>
      {agents.map((a: any, i: number) => {
        const agentThreads = threads.filter((t: any) => t.agentId === a.id);
        const unread = agentThreads.reduce((s: number, t: any) => s + t.unread, 0);
        const asking = pendingSet.has(a.id);

        return (
          <TouchableOpacity
            key={a.id}
            activeOpacity={0.7}
            onPress={() => {
              setAgent(a.id);
              router.push(`/threads/${a.id}`);
            }}
            style={[styles.agentRow, i > 0 && styles.rowBorder]}
          >
            <Avatar
              agent={a}
              size={44}
              dot={asking ? 'ask' : a.online ? 'online' : 'offline'}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.agentName}>{a.name}</Text>
              <Text style={styles.agentSub}>
                {asking ? 'needs approval' :
                  unread > 0 ? `${unread} new` :
                  `${agentThreads.length} threads`}
              </Text>
            </View>
            {asking ? (
              <View style={styles.askPill}>
                <Text style={styles.askText}>ask</Text>
              </View>
            ) : unread > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countText}>{unread}</Text>
              </View>
            ) : (
              <ChevronRightIcon color={C.muted} />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Pair new agent row */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/pair')}
        style={[styles.pairRow, styles.rowBorderDashed]}
      >
        <View style={styles.pairIcon}>
          <PlusIcon color={C.muted} size={18} />
        </View>
        <Text style={styles.pairText}>pair a new agent…</Text>
      </TouchableOpacity>
    </View>
  );
}

function InboxList({ items, agents }: any) {
  const router = useRouter();
  const { setAgent, markThreadRead } = useStore();

  return (
    <View style={{ gap: 8 }}>
      {items.map((t: any) => {
        const agent = agents.find((a: any) => a.id === t.agentId);
        const hasPending = t.messages.some((m: any) => m.role === 'approval' && m.status === 'pending');
        return (
          <TouchableOpacity
            key={t.id}
            activeOpacity={0.7}
            onPress={() => {
              setAgent(t.agentId);
              markThreadRead(t.id);
              router.push(`/chat/${t.agentId}/${t.id}`);
            }}
            style={[
              styles.inboxItem,
              hasPending && { backgroundColor: C.accentSoft, borderColor: 'transparent', borderLeftColor: C.accent, borderLeftWidth: 3 },
            ]}
          >
            <Avatar agent={agent} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.inboxTitle}>{t.title}</Text>
              <Text style={styles.inboxSub}>
                {agent?.name.toLowerCase()} · {t.updatedMin < 60 ? `${t.updatedMin}m` : `${Math.round(t.updatedMin / 60)}h`}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    paddingBottom: 10,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
  },
  segmentWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  segBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  segText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.ink2,
  },
  segTextActive: {
    fontWeight: '600',
    color: C.ink,
  },
  inboxBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  inboxBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  rowBorderDashed: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: C.borderStrong,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    letterSpacing: -0.2,
  },
  agentSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  askPill: {
    backgroundColor: C.accent,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  askText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countPill: {
    backgroundColor: C.ink,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: C.bg,
    fontSize: 11,
    fontWeight: '600',
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pairIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairText: {
    color: C.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  inboxItem: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  inboxTitle: {
    fontSize: 14,
    color: C.ink,
    lineHeight: 20,
  },
  inboxSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
    fontFamily: 'Courier New',
  },
});
