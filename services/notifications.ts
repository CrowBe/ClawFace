import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export async function scheduleLocalApprovalNotification(opts: {
  agentId: string;
  threadId: string;
  agentName: string;
  summary: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${opts.agentName} needs approval`,
      body: opts.summary,
      data: { agentId: opts.agentId, threadId: opts.threadId },
      sound: true,
    },
    trigger: null,
  });
}
