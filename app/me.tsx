import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/store';
import { Toggle } from '@/components/Toggle';
import { Toast } from '@/components/Toast';
import { BackIcon, ChevronRightIcon } from '@/components/Icons';
import { C } from '@/constants/colors';

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);
  const signOut = useStore(s => s.signOut);
  const agents = useStore(s => s.agents);
  const threads = useStore(s => s.threads);

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'This removes all paired agents, deletes their session keys from this device, and clears local message history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            signOut().then(() => router.replace('/')).catch(() => {});
          },
        },
      ],
    );
  };

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      agents: agents.map(a => ({ ...a, sessionKey: undefined })),
      threads,
    };
    Share.share({
      message: JSON.stringify(payload, null, 2),
      title: 'ClawFace data export',
    }).catch(() => {});
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileBlock}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>?</Text>
        </View>
        <View>
          <Text style={styles.profileName}>You</Text>
          <Text style={styles.profileEmail}>not signed in</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Group title="Device">
          <ToggleRow
            label="Biometric unlock"
            value={settings.biometric}
            onChange={v => updateSettings({ biometric: v })}
          />
          <ToggleRow
            label="Push notifications"
            value={settings.pushNotifs}
            onChange={v => updateSettings({ pushNotifs: v })}
          />
        </Group>

        <Group title="Appearance">
          <Row label="Theme" value="Light" />
          <Row label="Bubble density" value="Comfortable" />
        </Group>

        <Group title="Privacy & Security">
          <Row label="End-to-end encryption" value="Active ✓" />
          <Row label="Key management" value="" chevron onPress={() => router.push('/keys')} />
          <Row label="Export my data" value="" chevron onPress={handleExport} />
        </Group>

        <Group title="About">
          <Row label="Version" value="0.5.0" />
          <Row label="Privacy policy" value="" chevron onPress={() => router.push('/privacy')} />
          <Row label="Sign out" value="" chevron danger onPress={handleSignOut} />
        </Group>
      </ScrollView>

      <Toast />
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

function Row({ label, value, chevron, danger, onPress }: {
  label: string;
  value: string;
  chevron?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={[rowStyles.label, danger && { color: C.danger }]}>{label}</Text>
      <View style={rowStyles.right}>
        {value ? <Text style={rowStyles.value}>{value}</Text> : null}
        {chevron && <ChevronRightIcon color={C.muted} />}
      </View>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={rowStyles.row}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyles.row}>{content}</View>;
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
