// @ts-check
'use strict';

const crypto = require('crypto');
const os = require('os');
const WebSocket = require('ws');

const DEFAULT_URL = 'ws://127.0.0.1:18789';
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || DEFAULT_URL;
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const REQUEST_TIMEOUT_MS = process.env.OPENCLAW_GATEWAY_TIMEOUT_MS
  ? parseInt(process.env.OPENCLAW_GATEWAY_TIMEOUT_MS, 10)
  : 10_000;
// OpenClaw validates client.id/client.mode against its built-in Gateway enums.
// Until OpenClaw exposes a first-class ClawFace/mobile operator client id, use
// the read-only probe identity and declare ClawFace in displayName/userAgent.
const CLIENT_ID = 'openclaw-probe';
const CLIENT_DISPLAY_NAME = 'ClawFace Gateway Discovery';
const CLIENT_VERSION = 'cf-025-discovery';
const CLIENT_MODE = 'probe';
const ROLE = 'operator';
const SCOPES = ['operator.read'];
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** @param {Buffer} buf */
function base64UrlEncode(buf) {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

/** @param {string} publicKeyPem */
function publicKeyRawFromPem(publicKeyPem) {
  const spki = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  if (Buffer.isBuffer(spki) && spki.length === ED25519_SPKI_PREFIX.length + 32 && spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return Buffer.from(spki);
}

function createEphemeralDeviceIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const rawPublicKey = publicKeyRawFromPem(String(publicKeyPem));
  return {
    deviceId: crypto.createHash('sha256').update(rawPublicKey).digest('hex'),
    publicKey: base64UrlEncode(rawPublicKey),
    privateKeyPem: String(privateKeyPem),
  };
}

/** @param {string | undefined} value */
function normalizeDeviceMetadata(value) {
  return String(value || '').trim();
}

/**
 * Mirrors OpenClaw Gateway device-auth v3 payload ordering.
 * Do not include this payload in logs: it binds token material when a token is used.
 */
function buildDeviceAuthPayloadV3(params) {
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
    normalizeDeviceMetadata(params.platform),
    normalizeDeviceMetadata(params.deviceFamily),
  ].join('|');
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

/** @param {WebSocket} ws @param {unknown} payload */
function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

/** @param {unknown} value */
function objectKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

/** @param {unknown} value */
function summarizeValue(value) {
  if (Array.isArray(value)) return { type: 'array', count: value.length };
  if (value && typeof value === 'object') return { type: 'object', keys: objectKeys(value).slice(0, 20) };
  if (value == null) return { type: String(value) };
  return { type: typeof value };
}

/** @param {any} hello */
function printHelloSummary(hello) {
  const features = hello && typeof hello === 'object' ? hello.features : undefined;
  const auth = hello && typeof hello === 'object' ? hello.auth : undefined;
  const snapshot = hello && typeof hello === 'object' ? hello.snapshot : undefined;
  const methods = Array.isArray(features && features.methods) ? features.methods : [];
  const events = Array.isArray(features && features.events) ? features.events : [];

  console.log('[hello-ok]');
  console.log(JSON.stringify({
    protocol: hello && hello.protocol,
    server: summarizeValue(hello && hello.server),
    auth: auth && typeof auth === 'object' ? {
      role: auth.role,
      scopes: Array.isArray(auth.scopes) ? auth.scopes : [],
      deviceTokenIssued: typeof auth.deviceToken === 'string' && auth.deviceToken.length > 0,
      additionalDeviceTokens: Array.isArray(auth.deviceTokens) ? auth.deviceTokens.length : 0,
    } : null,
    features: {
      methodCount: methods.length,
      eventCount: events.length,
      methods: methods.slice(0, 30),
      events: events.slice(0, 30),
    },
    snapshot: summarizeValue(snapshot),
    policy: hello && hello.policy,
  }, null, 2));
}

function createGatewayClient() {
  const ws = new WebSocket(GATEWAY_URL);
  const pending = new Map();
  let helloOk = null;
  let challengeSeen = false;
  const device = createEphemeralDeviceIdentity();
  const platform = process.platform || os.platform();
  const deviceFamily = `node-${platform}`;

  const connectPromise = new Promise((resolve, reject) => {
    const connectTimer = setTimeout(() => {
      reject(new Error(`Gateway connect timed out waiting for hello-ok after ${REQUEST_TIMEOUT_MS}ms`));
      ws.close(1008, 'connect timeout');
    }, REQUEST_TIMEOUT_MS);

    ws.on('open', () => {
      // OpenClaw should send connect.challenge before accepting connect. If it
      // does not, the timeout reports that mismatch instead of sending a stale
      // or unsigned connect request.
    });

    ws.on('message', raw => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        const nonce = msg.payload && typeof msg.payload.nonce === 'string' ? msg.payload.nonce : '';
        if (!nonce) {
          clearTimeout(connectTimer);
          reject(new Error('connect.challenge missing nonce'));
          ws.close(1008, 'connect challenge missing nonce');
          return;
        }
        challengeSeen = true;
        const signedAtMs = Date.now();
        const signaturePayload = buildDeviceAuthPayloadV3({
          deviceId: device.deviceId,
          clientId: CLIENT_ID,
          clientMode: CLIENT_MODE,
          role: ROLE,
          scopes: SCOPES,
          signedAtMs,
          token: GATEWAY_TOKEN || null,
          nonce,
          platform,
          deviceFamily,
        });
        const signature = base64UrlEncode(crypto.sign(null, Buffer.from(signaturePayload, 'utf8'), crypto.createPrivateKey(device.privateKeyPem)));
        const params = {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: CLIENT_ID,
            displayName: CLIENT_DISPLAY_NAME,
            version: CLIENT_VERSION,
            platform,
            deviceFamily,
            mode: CLIENT_MODE,
          },
          role: ROLE,
          scopes: SCOPES,
          caps: [],
          commands: [],
          permissions: {},
          auth: GATEWAY_TOKEN ? { token: GATEWAY_TOKEN } : undefined,
          locale: process.env.LANG || 'en-US',
          userAgent: `clawface-gateway-discover/${CLIENT_VERSION}`,
          device: {
            id: device.deviceId,
            publicKey: device.publicKey,
            signature,
            signedAt: signedAtMs,
            nonce,
          },
        };
        sendJson(ws, { type: 'req', id: 'connect-1', method: 'connect', params });
        return;
      }

      if (msg.type === 'event') {
        return;
      }

      if (msg.type === 'res') {
        if (msg.id === 'connect-1') {
          clearTimeout(connectTimer);
          if (msg.ok) {
            helloOk = msg.payload;
            resolve(msg.payload);
          } else {
            const detail = msg.error && msg.error.details ? msg.error.details : undefined;
            const code = msg.error && msg.error.code ? msg.error.code : 'UNKNOWN';
            const message = msg.error && msg.error.message ? msg.error.message : 'connect failed';
            reject(new Error(`connect failed (${code}): ${message}${detail ? ` details=${JSON.stringify(detail)}` : ''}`));
            ws.close(1008, 'connect failed');
          }
          return;
        }

        const waiter = pending.get(msg.id);
        if (!waiter) return;
        pending.delete(msg.id);
        clearTimeout(waiter.timer);
        if (msg.ok) waiter.resolve(msg.payload);
        else waiter.reject(new Error(`${msg.error && msg.error.code ? msg.error.code : 'UNKNOWN'}: ${msg.error && msg.error.message ? msg.error.message : 'request failed'}`));
      }
    });

    ws.on('error', err => {
      clearTimeout(connectTimer);
      reject(err);
    });

    ws.on('close', () => {
      if (!helloOk && !challengeSeen) {
        clearTimeout(connectTimer);
        reject(new Error('Gateway closed before connect.challenge'));
      }
      for (const waiter of pending.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Gateway closed'));
      }
      pending.clear();
    });
  });

  function request(method, params) {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway socket is not open'));
        return;
      }
      const id = makeId();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      sendJson(ws, { type: 'req', id, method, params });
    });
  }

  return { ws, connectPromise, request };
}

async function main() {
  console.log(`[discover] Connecting to ${GATEWAY_URL}`);
  console.log(`[discover] Auth token: ${GATEWAY_TOKEN ? 'provided via OPENCLAW_GATEWAY_TOKEN' : 'not provided'}`);
  const client = createGatewayClient();
  const hello = await client.connectPromise;
  printHelloSummary(hello);

  const methods = new Set(Array.isArray(hello && hello.features && hello.features.methods) ? hello.features.methods : []);
  const probes = ['health', 'status', 'system-presence', 'sessions.list'];
  console.log('[probes] read-only discovery');
  for (const method of probes) {
    if (!methods.has(method)) {
      console.log(`- ${method}: skipped (not advertised)`);
      continue;
    }
    try {
      const payload = await client.request(method, {});
      console.log(`- ${method}: ok ${JSON.stringify(summarizeValue(payload))}`);
    } catch (err) {
      console.log(`- ${method}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  client.ws.close(1000, 'discovery complete');
}

main().catch(err => {
  console.error(`[discover] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
