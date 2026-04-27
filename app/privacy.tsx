import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BackIcon } from '@/components/Icons';
import { C } from '@/constants/colors';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.navBtn}>
          <BackIcon color={C.ink2} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.pageTitle}>Privacy</Text>
        <Text style={styles.subtitle}>How ClawFace handles your data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="What we collect">
          <P>
            ClawFace pairs with agents that you choose to run on your own machines. Messages,
            tool calls, approval decisions, and agent configuration all live on your device and
            on the machines you pair with.
          </P>
          <P>
            We do not run any backend service that receives your conversation content, and the
            app does not include analytics or third-party trackers.
          </P>
        </Section>

        <Section title="On your device">
          <P>
            Paired-agent metadata, threads, and messages are stored on the device using the
            operating system's standard app storage. Per-agent session keys are stored in the
            platform secure keystore (Android Keystore).
          </P>
        </Section>

        <Section title="Network connections">
          <P>
            ClawFace connects directly to the agents you pair with, over the network address
            you scan from their QR code. These connections are app-to-agent only and do not
            pass through any ClawFace-operated server.
          </P>
        </Section>

        <Section title="Push notifications">
          <P>
            If you grant notification permission, the app registers a push token with the
            platform notification service. The token is shared only with the agents you pair
            with, so they can notify you when they need a decision.
          </P>
        </Section>

        <Section title="Your controls">
          <P>
            You can remove a paired agent at any time from its config screen, which deletes its
            session key and message history. "Sign out" in Settings clears all paired agents,
            session keys, and on-device history.
          </P>
        </Section>

        <Section title="Contact">
          <P>Questions: bennycrow91@gmail.com</P>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  titleBlock: { paddingHorizontal: 20, paddingVertical: 4, paddingBottom: 12 },
  pageTitle: {
    fontSize: 32, fontWeight: '700', color: C.ink,
    letterSpacing: -0.8, lineHeight: 36,
  },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginTop: 18, gap: 8 },
  sectionTitle: {
    fontSize: 11, color: C.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    fontFamily: 'Courier New',
    marginBottom: 2,
  },
  body: { fontSize: 14, color: C.ink, lineHeight: 21 },
});
