import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Toggle } from '@/components/Toggle';
import { BackIcon, ChevronRightIcon } from '@/components/Icons';
import { C } from '@/constants/colors';

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [biometric, setBiometric] = React.useState(true);
  const [pushNotifs, setPushNotifs] = React.useState(true);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View style={styles.profileBlock}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>N</Text>
        </View>
        <View>
          <Text style={styles.profileName}>Noah</Text>
          <Text style={styles.profileEmail}>noah@example.com · Pro plan</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Group title="Device">
          <ToggleRow label="Biometric unlock" value={biometric} onChange={setBiometric} />
          <ToggleRow label="Push notifications" value={pushNotifs} onChange={setPushNotifs} />
        </Group>

        <Group title="Appearance">
          <Row label="Theme" value="Light" />
          <Row label="Bubble density" value="Comfortable" />
        </Group>

        <Group title="Privacy & Security">
          <Row label="End-to-end encryption" value="Active ✓" />
          <Row label="Key management" value="" chevron />
          <Row label="Export my data" value="" chevron />
        </Group>

        <Group title="About">
          <Row label="Version" value="0.4.2" />
          <Row label="Privacy policy" value="" chevron />
          <Row label="Sign out" value="" chevron danger />
        </Group>
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

function Row({ label, value, chevron, danger }: {
  label: string;
  value: string;
  chevron?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, danger && { color: C.danger }]}>{label}</Text>
      <View style={rowStyles.right}>
        {value ? <Text style={rowStyles.value}>{value}</Text> : null}
        {chevron && <ChevronRightIcon color={C.muted} />}
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Toggle value={value} onChange={onChange} />
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
  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#D9CDEC',
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitial: { fontSize: 24, fontWeight: '600', color: C.ink },
  profileName: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  profileEmail: { fontSize: 12, color: C.muted, fontFamily: 'Courier New', marginTop: 2 },
  scroll: { paddingBottom: 40 },
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
