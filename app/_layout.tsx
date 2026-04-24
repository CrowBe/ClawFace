import React from 'react';
import { View, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from '@/constants/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
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
      </Stack>
    </SafeAreaProvider>
  );
}
