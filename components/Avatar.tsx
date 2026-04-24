import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
import type { Agent } from '@/data/seed';

interface Props {
  agent: Agent;
  size?: number;
  dot?: 'online' | 'ask' | 'offline' | 'none';
}

export function Avatar({ agent, size = 40, dot = 'none' }: Props) {
  const radius = Math.round(size * 0.27);
  const dotSize = Math.max(9, size * 0.26);
  const fontSize = size * 0.38;

  const dotColor =
    dot === 'ask' ? C.accent :
    dot === 'online' ? C.success :
    C.muted;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View style={[styles.base, { width: size, height: size, borderRadius: radius, backgroundColor: agent.tint }]}>
        <Text style={[styles.mono, { fontSize }]}>{agent.mono}</Text>
      </View>
      {dot !== 'none' && (
        <View style={[styles.dot, {
          width: dotSize, height: dotSize, borderRadius: dotSize / 2,
          backgroundColor: dotColor,
          bottom: -1, right: -1,
        }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mono: {
    fontWeight: '600',
    color: '#2A2824',
    letterSpacing: -0.5,
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: C.bg,
  },
});
