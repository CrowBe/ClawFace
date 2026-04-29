import * as Crypto from 'expo-crypto';
import * as ed25519 from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { getGatewayDeviceIdentitySeed, setGatewayDeviceIdentitySeed } from '@/services/secureStore';
import type { GatewayDeviceIdentity } from '@/services/transport/openclaw-gateway';

ed25519.hashes.sha512 = sha512;

const PLATFORM = 'mobile';
const DEVICE_FAMILY = 'clawface-mobile';

interface SigningParams {
  agentId: string;
  nonce: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  token?: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    output += alphabet[(triple >> 18) & 63];
    output += alphabet[(triple >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
  }
  return output.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const chunk = padded.slice(i, i + 4);
    const n = chunk.split('').reduce((acc, char) => (acc << 6) | (char === '=' ? 0 : alphabet.indexOf(char)), 0);
    bytes.push((n >> 16) & 255);
    if (chunk[2] !== '=') bytes.push((n >> 8) & 255);
    if (chunk[3] !== '=') bytes.push(n & 255);
  }

  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function utf8Encode(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(bytes);
}

function buildDeviceAuthPayloadV3(params: Omit<SigningParams, 'agentId'> & { deviceId: string; signedAtMs: number }): string {
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token || '',
    params.nonce,
    PLATFORM,
    DEVICE_FAMILY,
  ].join('|');
}

async function getOrCreateSeed(agentId: string): Promise<Uint8Array> {
  const stored = await getGatewayDeviceIdentitySeed(agentId);
  if (stored) return base64UrlDecode(stored);

  const seed = await Crypto.getRandomBytesAsync(32);
  await setGatewayDeviceIdentitySeed(agentId, base64UrlEncode(seed));
  return seed;
}

export async function getSignedGatewayDeviceIdentity(params: SigningParams): Promise<GatewayDeviceIdentity> {
  const seed = await getOrCreateSeed(params.agentId);
  const publicKey = ed25519.getPublicKey(seed);
  const deviceId = bytesToHex(sha256(publicKey));
  const signedAt = Date.now();
  const payload = buildDeviceAuthPayloadV3({ ...params, deviceId, signedAtMs: signedAt });
  const signature = ed25519.sign(utf8Encode(payload), seed);

  return {
    id: deviceId,
    publicKey: base64UrlEncode(publicKey),
    signature: base64UrlEncode(signature),
    signedAt,
    nonce: params.nonce,
  };
}
