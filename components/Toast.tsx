import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '@/store';

export function Toast() {
  const toast = useStore(s => s.toast);
  if (!toast) return null;
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.pill}>
        <Text style={styles.text}>{toast}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 300,
  },
  pill: {
    backgroundColor: 'rgba(26,24,22,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  text: {
    color: '#FAF7F0',
    fontSize: 13,
    fontWeight: '500',
  },
});
