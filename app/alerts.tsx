import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Avatar } from '@/components/Avatar';
import { Toast } from '@/components/Toast';
import { BackIcon, CheckIcon } from '@/components/Icons';
import { C } from '@/constants/colors';

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const agents = useStore(s => s.agents);
  const threads = useStore(s => s.threads);
  const resolveApproval = useStore(s => s.resolveApproval);
  const markThreadRead = useStore(s => s.markThreadRead);
  const now = Date.now();

  // Build approval items and info items from threads
  const pendingApprovals: Array<{
    threadId: string;
    msgId: number;
    agentId: string;
    title: string;
    when: string;
    expired: boolean;
  }> = [];

  const infoItems: Array<{
    threadId: string;
    agentId: string;
    title: string;
    when: string;
  }> = [];

  threads.forEach(t => {
    t.messages.forEach(m => {
      if (m.role === 'approval' && m.status === 'pending') {
        pendingApprovals.push({
          threadId: t.id,
          msgId: m.id,
          agentId: t.agentId,
          title: m.summary ?? 'Approval needed',
          when: m.t ?? '',
          expired: m.expiresAt != null && now >= m.expiresAt,
        });
      }
    });
    if (t.unread > 0) {
      const lastMsg = t.messages[t.messages.length - 1];
      infoItems.push({
        threadId: t.id,
        agentId: t.agentId,
        title: t.preview,
        when: t.updatedMin < 60 ? `${t.updatedMin}m` : `${Math.round(t.updatedMin / 60)}h`,
      });
    }
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            threads.forEach(t => {
              if (t.unread > 0) markThreadRead(t.id);
            });
          }}
        >
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.pageTitle}>Alerts</Text>
        <Text style={styles.subtitle}>Approvals and activity from all agents</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Pending approvals */}
        {pendingApprovals.map(item => {
          const agent = agents.find(a => a.id === item.agentId);
          if (!agent) return null;
          return (
            <View
              key={`${item.threadId}-${item.msgId}`}
              style={[styles.approvalCard, item.expired && styles.expiredApprovalCard]}
            >
              <View style={styles.approvalHeader}>
                <Avatar agent={agent} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.approvalAgentName}>{agent.name} · {item.threadId}</Text>
                  <Text style={[styles.approvalWhen, item.expired && styles.expiredText]}>
                    {item.expired ? 'Expired' : 'needs approval'} · {item.when}
                  </Text>
                </View>
              </View>
              <Text style={[styles.approvalTitle, item.expired && styles.expiredText]}>{item.title}</Text>
              <View style={styles.approvalActions}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={item.expired}
                  onPress={() => resolveApproval(item.threadId, item.msgId, 'approved')}
                  style={[styles.approveBtn, item.expired && styles.disabledBtn]}
                >
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={item.expired}
                  onPress={() => resolveApproval(item.threadId, item.msgId, 'denied')}
                  style={[styles.denyBtn, item.expired && styles.disabledBtn]}
                >
                  <Text style={styles.denyBtnText}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    markThreadRead(item.threadId);
                    router.push(`/chat/${item.agentId}/${item.threadId}`);
                  }}
                  style={styles.openBtn}
                >
                  <Text style={styles.openBtnText}>Open</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {infoItems.length > 0 && (
          <Text style={styles.sectionLabel}>Earlier</Text>
        )}

        {infoItems.map(item => {
          const agent = agents.find(a => a.id === item.agentId);
          if (!agent) return null;
          return (
            <TouchableOpacity
              key={item.threadId}
              activeOpacity={0.7}
              onPress={() => {
                markThreadRead(item.threadId);
                router.push(`/chat/${item.agentId}/${item.threadId}`);
              }}
              style={styles.infoRow}
            >
              <Avatar agent={agent} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoSub}>{agent.name.toLowerCase()} · {item.when}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {pendingApprovals.length === 0 && infoItems.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All clear. No pending approvals.</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  markAll: { fontSize: 13, color: C.accent, fontWeight: '500' },
  titleBlock: { paddingHorizontal: 20, paddingVertical: 4, paddingBottom: 12 },
  pageTitle: {
    fontSize: 32, fontWeight: '700', color: C.ink,
    letterSpacing: -0.8, lineHeight: 36,
  },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  approvalCard: {
    backgroundColor: C.accentSoft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.accent,
    gap: 10,
  },
  expiredApprovalCard: {
    backgroundColor: C.surface2,
    borderColor: C.border,
  },
  approvalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  approvalAgentName: { fontSize: 14, fontWeight: '600', color: C.ink },
  approvalWhen: {
    fontSize: 11, color: C.accentInk,
    fontFamily: 'Courier New',
  },
  approvalTitle: { fontSize: 15, color: C.ink },
  expiredText: { color: C.muted },
  approvalActions: { flexDirection: 'row', gap: 6 },
  approveBtn: {
    flex: 1, padding: 9, borderRadius: 11,
    backgroundColor: C.ink, alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  denyBtn: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 11,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  denyBtnText: { color: C.ink2, fontSize: 14, fontWeight: '500' },
  disabledBtn: { opacity: 0.45 },
  openBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  openBtnText: { color: C.ink2, fontSize: 14, fontWeight: '500' },
  sectionLabel: {
    fontSize: 11, color: C.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    fontFamily: 'Courier New',
    paddingTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoTitle: { fontSize: 13, color: C.ink },
  infoSub: {
    fontSize: 11, color: C.muted,
    fontFamily: 'Courier New', marginTop: 2,
  },
  empty: {
    paddingVertical: 48, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: C.muted },
});
