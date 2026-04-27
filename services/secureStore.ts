import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'clawface_session_';

export async function getSessionKey(agentId: string): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_PREFIX + agentId);
}

export async function setSessionKey(agentId: string, key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + agentId, key);
}

export async function deleteSessionKey(agentId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PREFIX + agentId);
}
