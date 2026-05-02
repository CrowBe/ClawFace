import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Avatar } from '@/components/Avatar';
import { BackIcon, DotsIcon, SearchIcon, PlusIcon } from '@/components/Icons';
import { C } from '@/constants/colors';
import {
  formatAgentContext,
  getAgentThreads,
  groupThreadsByWorkstreamFolder,
  isPendingHandoff,
  searchThreads,
} from '@/domain/workstreams';
import type { Thread } from '@/data/seed';

export default function ThreadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const agents = useStore(s => s.agents);
  const threads = useStore(s => s.threads);
  const markThreadRead = useStore(s => s.markThreadRead);
  const addThread = useStore(s => s.addThread);
  const refreshThreads = useStore(s => s.refreshThreads);

  const [mode, setMode] = useState<'flat' | 'folders'>('flat');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const agent = agents.find(a => a.id === agentId);
  const agentThreads = searchThreads(getAgentThreads(threads, agentId), search);

  useEffect(() => {
    if (agent) {
      refreshThreads(agentId).catch(() => {});
    }
  }, [agent, agentId, refreshThreads]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshThreads(agentId);
    } catch {
      // best-effort
    } finally {
      setRefreshing(false);
    }
  }, [agentId, refreshThreads]);

  const handleNewThread = useCallback(async (title?: string) => {
    const { resolveTransport } = await import('@/services/transport');
    if (!agent) return;
    setCreating(true);
    try {
      const transport = resolveTransport(agent);
      const newThread = await transport.createThread(agentId, title || undefined);
      addThread(newThread);
      setShowNewThread(false);
      setNewThreadTitle('');
      router.push(`/chat/${agentId}/${newThread.id}`);
    } catch {
      // creation failed
    } finally {
      setCreating(false);
    }
  }, [agent, agentId, addThread, router]);

  if (!agent) return null;

  const folders = groupThreadsByWorkstreamFolder(agentThreads);
  const contextLine = formatAgentContext(agent);
  const totalThreads = getAgentThreads(threads, agentId).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
        <Avatar agent={agent} size={34} dot={agent.online ? 'online' : 'offline'} />
        <View style={{ flex: 1 }}>
          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agentRole} numberOfLines={1}>{contextLine}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/config/${agentId}`)}
          style={styles.navBtn}
        >
          <DotsIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      {/* Thread count + Flat/Folders toggle */}
      <View style={styles.modeWrap}>
        <Text style={styles.threadCount}>
          {totalThreads} {totalThreads === 1 ? 'thread' : 'threads'}
        </Text>
        <View style={styles.segment}>
          {(['flat', 'folders'] as const).map(m => (
            <TouchableOpacity
              key={m}
              activeOpacity={0.7}
              onPress={() => setMode(m)}
              style={[styles.segBtn, mode === m && styles.segBtnActive]}
            >
              <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <SearchIcon color={C.muted} size={16} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search threads"
          placeholderTextColor={C.muted}
          returnKeyType="search"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={() => setShowNewThread(true)}>
          <View style={styles.newThreadBtn}>
            <PlusIcon color={C.accent} size={14} />
            <Text style={styles.newThread}>New</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.muted}
            colors={[C.accent]}
          />
        }
      >
        {agentThreads.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {search ? 'No matching threads' : 'No threads yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {search
                ? 'Try a different search term.'
                : 'Start a new thread to begin a conversation with this agent.'}
            </Text>
            {!search && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowNewThread(true)}
                style={styles.emptyBtn}
              >
                <Text style={styles.emptyBtnText}>New thread</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : mode === 'flat' ? (
          <View style={styles.card}>
            {agentThreads.map((t, i) => (
              <ThreadRow
                key={t.id}
                thread={t}
                first={i === 0}
                pending={isPendingHandoff(t)}
                onPress={() => {
                  markThreadRead(t.id);
                  router.push(`/chat/${agentId}/${t.id}`);
                }}
              />
            ))}
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {Object.entries(folders).map(([folder, items]) => (
              <View key={folder}>
                <Text style={styles.folderLabel}>{folder} · {items.length}</Text>
                <View style={styles.card}>
                  {items.map((t, i) => (
                    <ThreadRow
                      key={t.id}
                      thread={t}
                      first={i === 0}
                      pending={isPendingHandoff(t)}
                      onPress={() => {
                        markThreadRead(t.id);
                        router.push(`/chat/${agentId}/${t.id}`);
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Thread Modal */}
      <Modal
        visible={showNewThread}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewThread(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowNewThread(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>New thread</Text>
            <Text style={styles.modalSub}>Start a new session with {agent.name}</Text>
            <TextInput
              style={styles.modalInput}
              value={newThreadTitle}
              onChangeText={setNewThreadTitle}
              placeholder="Thread title (optional)"
              placeholderTextColor={C.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => handleNewThread(newThreadTitle)}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { setShowNewThread(false); setNewThreadTitle(''); }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleNewThread(newThreadTitle)}
                disabled={creating}
                style={[styles.modalCreateBtn, creating && { opacity: 0.5 }]}
              >
                <Text style={styles.modalCreateText}>
                  {creating ? 'Creating…' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ThreadRow({ thread, first, pending, onPress }: {
  thread: Thread;
  first: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const updatedLabel =
    thread.updatedMin < 60 ? `${thread.updatedMin}m` :
    thread.updatedMin < 60 * 24 ? `${Math.round(thread.updatedMin / 60)}h` :
    'yday';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.threadRow, !first && styles.rowBorder]}
    >
      <View style={[
        styles.threadIcon,
        { backgroundColor: pending ? C.accent : C.surface2, borderColor: pending ? C.accent : C.border },
      ]}>
        <Text style={[styles.threadIconText, { color: pending ? '#fff' : C.ink2 }]}>
          #{thread.id.slice(0, 2)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.threadTitleRow}>
          <Text style={styles.threadTitle}>{thread.title}</Text>
          <Text style={styles.threadTime}>{updatedLabel}</Text>
        </View>
        <Text style={styles.threadPreview} numberOfLines={1}>{thread.preview}</Text>
      </View>
      {thread.unread > 0 && !pending && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{thread.unread}</Text>
        </View>
      )}
      {pending && (
        <View style={styles.askPill}>
          <Text style={styles.askText}>ask</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  agentName: { fontSize: 15, fontWeight: '600', color: C.ink, letterSpacing: -0.2 },
  agentRole: { fontSize: 11, color: C.muted, fontFamily: 'Courier New' },
  modeWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  threadCount: {
    fontSize: 12,
    color: C.muted,
    fontFamily: 'Courier New',
    fontWeight: '500',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  segText: { fontSize: 13, fontWeight: '500', color: C.ink2 },
  segTextActive: { fontWeight: '600', color: C.ink },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.ink },
  newThreadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  newThread: { fontSize: 13, fontWeight: '600', color: C.accent },
  scroll: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  folderLabel: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Courier New',
    paddingHorizontal: 8,
    paddingBottom: 6,
    marginBottom: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBtn: {
    marginTop: 18,
    backgroundColor: C.ink,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '600',
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  threadIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  threadIconText: {
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: '600',
  },
  threadTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  threadTitle: {
    fontSize: 15, fontWeight: '600', color: C.ink, letterSpacing: -0.2,
    flex: 1,
  },
  threadTime: { fontSize: 11, color: C.muted, fontFamily: 'Courier New' },
  threadPreview: {
    fontSize: 13, color: C.muted, marginTop: 2,
  },
  unreadBadge: {
    backgroundColor: C.ink,
    minWidth: 20, height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: C.bg, fontSize: 11, fontWeight: '600' },
  askPill: {
    backgroundColor: C.accent,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 8,
  },
  askText: {
    color: '#fff', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.surface2,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink2,
  },
  modalCreateBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.ink,
  },
  modalCreateText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.bg,
  },
});
