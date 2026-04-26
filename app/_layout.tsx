import React, { useEffect } from 'react';
import { View, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { C } from '@/constants/colors';
import { useStore } from '@/store';
import { hydrateState } from '@/services/persistence';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function HydrationAndNotifications() {
  const router = useRouter();

  useEffect(() => {
    hydrateState().then(saved => {
      if (!saved) return;
      useStore.getState().rehydrateAndConnect(saved).catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as {
        agentId?: string;
        threadId?: string;
      };
      if (data.agentId && data.threadId) {
        router.push(`/chat/${data.agentId}/${data.threadId}`);
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <HydrationAndNotifications />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="threads/[agentId]" />
        <Stack.Screen name="chat/[agentId]/[threadId]" />
        <Stack.Screen name="pair" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="config/[agentId]" />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="me" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="keys" />
      </Stack>
    </SafeAreaProvider>
  );
}
