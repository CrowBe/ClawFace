import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'clawface_session_';
const GATEWAY_DEVICE_TOKEN_PREFIX = 'clawface_gateway_device_token_';
const GATEWAY_DEVICE_IDENTITY_SEED_PREFIX = 'clawface_gateway_device_identity_seed_';

export async function getSessionKey(agentId: string): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_PREFIX + agentId);
}

export async function setSessionKey(agentId: string, key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + agentId, key);
}

export async function deleteSessionKey(agentId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PREFIX + agentId);
}

export async function getGatewayDeviceToken(agentId: string): Promise<string | null> {
  return SecureStore.getItemAsync(GATEWAY_DEVICE_TOKEN_PREFIX + agentId);
}

export async function setGatewayDeviceToken(agentId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(GATEWAY_DEVICE_TOKEN_PREFIX + agentId, token);
}

export async function deleteGatewayDeviceToken(agentId: string): Promise<void> {
  await SecureStore.deleteItemAsync(GATEWAY_DEVICE_TOKEN_PREFIX + agentId);
}

export async function getGatewayDeviceIdentitySeed(agentId: string): Promise<string | null> {
  return SecureStore.getItemAsync(GATEWAY_DEVICE_IDENTITY_SEED_PREFIX + agentId);
}

export async function setGatewayDeviceIdentitySeed(agentId: string, seed: string): Promise<void> {
  await SecureStore.setItemAsync(GATEWAY_DEVICE_IDENTITY_SEED_PREFIX + agentId, seed);
}

export async function deleteGatewayDeviceIdentitySeed(agentId: string): Promise<void> {
  await SecureStore.deleteItemAsync(GATEWAY_DEVICE_IDENTITY_SEED_PREFIX + agentId);
}
