import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { ShieldIcon, CheckIcon } from './Icons';
import type { Message } from '@/data/seed';

interface Props {
  msg: Message;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalCard({ msg, onApprove, onDeny }: Props) {
  const pending = msg.status === 'pending';
  const statusColor =
    msg.status === 'approved' ? C.success :
    msg.status === 'denied' ? C.muted :
    C.accent;

  return (
    <View style={[
      styles.card,
      { backgroundColor: pending ? C.accentSoft : C.surface2 },
      { borderColor: pending ? C.accent : C.border },
      !pending && { opacity: 0.75 },
    ]}>
      <View style={styles.header}>
        <ShieldIcon color={statusColor} size={16} />
        <Text style={styles.summary}>{msg.summary}</Text>
        <Text style={[styles.status, { color: statusColor }]}>
          {msg.status?.toUpperCase()}
        </Text>
      </View>

      {msg.files && (
        <View style={styles.codeBlock}>
          {msg.files.map((f, i) => (
            <Text key={i} style={styles.codeText}>{f}</Text>
          ))}
        </View>
      )}

      {msg.diff && msg.diff.length > 0 && (
        <View style={styles.diffBlock}>
          {msg.diff.map((d, i) => (
            <Text key={i} style={[
              styles.diffLine,
              d.type === 'plus' && { color: C.success },
              d.type === 'minus' && { color: C.danger, textDecorationLine: 'line-through' },
              d.type === 'plain' && { color: C.ink2 },
            ]}>
              <Text style={styles.diffMarker}>
                {d.type === 'plus' ? '+ ' : d.type === 'minus' ? '− ' : '› '}
              </Text>
              {d.text}
            </Text>
          ))}
        </View>
      )}

      {pending && (
        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.7} onPress={onDeny} style={styles.denyBtn}>
            <Text style={styles.denyText}>Deny</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={onApprove} style={styles.approveBtn}>
            <CheckIcon color="#fff" size={14} />
            <Text style={styles.approveText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summary: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    letterSpacing: -0.2,
  },
  status: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  codeBlock: {
    backgroundColor: '#FAF7EE',
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.08)',
    borderRadius: 10,
    padding: 10,
  },
  codeText: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: C.ink2,
    lineHeight: 18,
  },
  diffBlock: {
    backgroundColor: '#FAF7EE',
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.08)',
    borderRadius: 10,
    padding: 10,
  },
  diffLine: {
    fontFamily: 'Courier New',
    fontSize: 11,
    lineHeight: 18,
  },
  diffMarker: {
    opacity: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  denyBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  denyText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink2,
  },
  approveBtn: {
    flex: 2,
    padding: 10,
    borderRadius: 10,
    backgroundColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
