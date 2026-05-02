import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Avatar } from '@/components/Avatar';
import { ApprovalCard } from '@/components/ApprovalCard';
import { ToolCallChip } from '@/components/ToolCallChip';
import { Toggle } from '@/components/Toggle';
import { Toast } from '@/components/Toast';
import { BackIcon, DotsIcon, SendIcon } from '@/components/Icons';
import { C } from '@/constants/colors';
import { formatThreadContext, getThreadRoute } from '@/domain/workstreams';
import type { Message } from '@/data/seed';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { agentId, threadId } = useLocalSearchParams<{ agentId: string; threadId: string }>();

  const agents = useStore(s => s.agents);
  const threads = useStore(s => s.threads);
  const resolveApproval = useStore(s => s.resolveApproval);
  const sendMessage = useStore(s => s.sendMessage);
  const openThread = useStore(s => s.openThread);

  const route = getThreadRoute(threads, threadId);
  const agent = agents.find(a => a.id === (route?.agentId ?? agentId));
  const thread = threads.find(t => t.id === threadId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (agentId && threadId) {
      openThread(agentId, threadId).catch(() => {});
    }
  }, [agentId, threadId, openThread]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [thread?.messages.length]);

  if (!agent || !thread) return null;

  const contextLine = formatThreadContext(thread, agent);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(threadId, input.trim());
    setInput('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
        <Avatar agent={agent} size={30} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.threadTitle}>{thread.title}</Text>
          <Text style={styles.agentSub} numberOfLines={1}>{contextLine}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setMenuOpen(v => !v)}
          style={styles.navBtn}
        >
          <DotsIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      {/* Context menu */}
      {menuOpen && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menu}>
            <MenuItem
              label="Auto-approve in thread"
              right={<Toggle value={autoApprove} onChange={setAutoApprove} />}
            />
            <MenuItem label="Mute" />
            <MenuItem label="Rename" />
            <MenuItem label="Export transcript" />
            <MenuItem
              label="Archive"
              danger
              onPress={() => { setMenuOpen(false); router.back(); }}
            />
          </View>
        </>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
      >
        {thread.messages.map((m, i) => (
          <MessageItem
            key={m.id}
            msg={m}
            threadId={threadId}
            onApprove={() => resolveApproval(threadId, m.id, 'approved')}
            onDeny={() => resolveApproval(threadId, m.id, 'denied')}
          />
        ))}

        {/* Typing indicator */}
        <View style={styles.typingRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.typingDot, { opacity: 0.4 + i * 0.2 }]} />
          ))}
        </View>
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Reply to ${agent.name.split(' ')[0]}…`}
          placeholderTextColor={C.muted}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSend}
          style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.5 }]}
        >
          <SendIcon color="#fff" size={18} />
        </TouchableOpacity>
      </View>

      <Toast />
    </KeyboardAvoidingView>
  );
}

function MessageItem({ msg, threadId, onApprove, onDeny }: {
  msg: Message;
  threadId: string;
  onApprove: () => void;
  onDeny: () => void;
}) {
  if (msg.role === 'user') {
    return (
      <View style={msgStyles.userBubble}>
        <Text style={msgStyles.userText}>{msg.text}</Text>
      </View>
    );
  }
  if (msg.role === 'agent') {
    return (
      <View style={msgStyles.agentBubble}>
        <Text style={msgStyles.agentText}>{msg.text}</Text>
      </View>
    );
  }
  if (msg.role === 'tool') {
    return <ToolCallChip msg={msg} />;
  }
  if (msg.role === 'approval') {
    return (
      <ApprovalCard
        msg={msg}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    );
  }
  return null;
}

function MenuItem({ label, right, danger, onPress }: {
  label: string;
  right?: React.ReactNode;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={menuItemStyles.row}
    >
      <Text style={[menuItemStyles.label, danger && { color: C.danger }]}>{label}</Text>
      {right}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  threadTitle: { fontSize: 15, fontWeight: '600', color: C.ink, letterSpacing: -0.2 },
  agentSub: { fontSize: 11, color: C.muted, fontFamily: 'Courier New' },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
  },
  menu: {
    position: 'absolute',
    top: 56,
    right: 14,
    zIndex: 100,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 10,
    minWidth: 220,
  },
  messages: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  typingRow: {
    flexDirection: 'row',
    gap: 4,
    padding: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  typingDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: C.muted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const msgStyles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: C.ink,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomRightRadius: 5,
  },
  userText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FAF6ED',
  },
  agentBubble: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    backgroundColor: C.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  agentText: {
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
  },
});

const menuItemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: C.ink,
  },
});
