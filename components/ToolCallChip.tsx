import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import { TerminalIcon } from './Icons';
import type { Message } from '@/data/seed';

interface Props {
  msg: Message;
}

export function ToolCallChip({ msg }: Props) {
  return (
    <View style={styles.chip}>
      <TerminalIcon color={C.muted} size={12} />
      <Text style={styles.name}>{msg.name}</Text>
      {msg.arg && <Text style={styles.arg}>{msg.arg}</Text>}
      <View style={styles.right}>
        {msg.result && <Text style={styles.result}>{msg.result}</Text>}
        <Text style={[styles.status, { color: msg.status === 'done' ? C.success : C.accent }]}>
          {msg.status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    backgroundColor: C.surface2,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: '600',
    color: C.ink2,
  },
  arg: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: C.muted,
  },
  right: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  result: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: C.muted,
  },
  status: {
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
