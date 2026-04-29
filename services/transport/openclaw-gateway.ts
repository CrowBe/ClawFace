import type { Agent, Thread } from '@/data/seed';
import { getSignedGatewayDeviceIdentity } from '@/services/gatewayDeviceIdentity';
import { deleteGatewayDeviceIdentitySeed, deleteGatewayDeviceToken, getGatewayDeviceToken, setGatewayDeviceToken } from '@/services/secureStore';
import { GatewayTransportEventNormalizer } from './normalize';
import type { AgentTransport, TransportEvent, TransportListener } from './types';

type SocketState = 'disconnected' | 'connecting' | 'connected';

type PendingRequest = {
  timeout: ReturnType<typeof setTimeout>;
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
};

type GatewayPolicy = {
  maxPayload?: number;
  maxBufferedBytes?: number;
  tickIntervalMs?: number;
};

export interface GatewayDeviceIdentity {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

interface GatewayConnectOptions {
  token?: string;
  scopes?: string[];
  device?: (challenge: { nonce: string; ts?: number }, auth: { token?: string; scopes: string[] }) => Promise<GatewayDeviceIdentity | undefined>;
}

const DEFAULT_GATEWAY_PORT = 18789;
const REQUEST_TIMEOUT_MS = 15_000;
const CLIENT_ID = 'openclaw-probe';
const CLIENT_DISPLAY_NAME = 'ClawFace Mobile';
const CLIENT_VERSION = 'cf-026-gateway-transport';
const CLIENT_MODE = 'probe';
const ROLE = 'operator';
const DEFAULT_SCOPES = ['operator.read', 'operator.write', 'operator.pairing'];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildGatewayUrl(agent: Agent): string {
  const protocol = agent.secure ? 'wss' : 'ws';
  const normalizedHost = agent.host
    .replace(/^wss?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:$/, '');
  const hasPort = /:\d+$/.test(normalizedHost);
  const authority = hasPort ? normalizedHost : `${normalizedHost}:${agent.port ?? DEFAULT_GATEWAY_PORT}`;
  return `${protocol}://${authority}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function parsePositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractGatewayPolicy(helloOk: unknown): GatewayPolicy | undefined {
  if (!isObject(helloOk) || !isObject(helloOk.policy)) return undefined;
  const policy: GatewayPolicy = {
    maxPayload: parsePositiveNumber(helloOk.policy.maxPayload),
    maxBufferedBytes: parsePositiveNumber(helloOk.policy.maxBufferedBytes),
    tickIntervalMs: parsePositiveNumber(helloOk.policy.tickIntervalMs),
  };
  return policy.maxPayload || policy.maxBufferedBytes || policy.tickIntervalMs ? policy : undefined;
}

function extractChallenge(value: unknown): { nonce: string; ts?: number } | null {
  if (!isObject(value) || value.type !== 'event' || value.event !== 'connect.challenge' || !isObject(value.payload)) return null;
  const nonce = value.payload.nonce;
  if (typeof nonce !== 'string' || nonce.length === 0) return null;
  return { nonce, ts: typeof value.payload.ts === 'number' ? value.payload.ts : undefined };
}

export class OpenClawGatewayTransport implements AgentTransport {
  private sockets = new Map<string, WebSocket>();
  private states = new Map<string, SocketState>();
  private agents = new Map<string, Agent>();
  private listeners: Set<TransportListener> = new Set();
  private pending = new Map<string, Map<string, PendingRequest>>();
  private normalizers = new Map<string, GatewayTransportEventNormalizer>();
  private options = new Map<string, GatewayConnectOptions>();
  private policies = new Map<string, GatewayPolicy>();
  private tickWatches = new Map<string, ReturnType<typeof setInterval>>();
  private lastGatewayActivityAt = new Map<string, number>();
  private deviceIds = new Map<string, string>();
  private subscribedThreads = new Map<string, Set<string>>();

  subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setConnectOptions(agentId: string, options: GatewayConnectOptions): void {
    this.options.set(agentId, options);
  }

  private emit(event: TransportEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  async connect(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
    this.states.set(agent.id, 'connecting');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(buildGatewayUrl(agent));
      const normalizer = this.normalizers.get(agent.id) ?? new GatewayTransportEventNormalizer();
      this.normalizers.set(agent.id, normalizer);
      this.sockets.set(agent.id, ws);
      this.pending.set(agent.id, new Map());
      this.subscribedThreads.set(agent.id, new Set());

      const connectTimeout = setTimeout(() => {
        reject(new Error('Timed out waiting for OpenClaw Gateway hello-ok'));
        ws.close();
      }, REQUEST_TIMEOUT_MS);

      ws.onmessage = async event => {
        let frame: unknown;
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          this.emit({ type: 'transport_notice', level: 'warning', message: 'Ignoring non-JSON Gateway frame' });
          return;
        }

        this.markGatewayActivity(agent.id);

        const challenge = extractChallenge(frame);
        if (challenge) {
          try {
            const opts = this.options.get(agent.id) ?? {};
            const storedDeviceToken = await getGatewayDeviceToken(agent.id).catch(() => null);
            const token = opts.token ?? storedDeviceToken ?? agent.sessionKey;
            const scopes = opts.scopes ?? DEFAULT_SCOPES;
            const device = await (opts.device
              ? opts.device(challenge, { token: token ?? undefined, scopes })
              : getSignedGatewayDeviceIdentity({
                agentId: agent.id,
                nonce: challenge.nonce,
                clientId: CLIENT_ID,
                clientMode: CLIENT_MODE,
                role: ROLE,
                scopes,
                token: token ?? undefined,
              }));
            if (device?.id) this.deviceIds.set(agent.id, device.id);
            ws.send(JSON.stringify({
              type: 'req',
              id: 'connect-1',
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: CLIENT_ID,
                  displayName: CLIENT_DISPLAY_NAME,
                  version: CLIENT_VERSION,
                  platform: 'mobile',
                  deviceFamily: 'clawface-mobile',
                  mode: CLIENT_MODE,
                },
                role: ROLE,
                scopes,
                caps: [],
                commands: [],
                permissions: {},
                auth: token ? { token } : undefined,
                userAgent: `clawface-mobile/${CLIENT_VERSION}`,
                device,
              },
            }));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
            ws.close();
          }
          return;
        }

        if (isObject(frame) && frame.type === 'res' && frame.id === 'connect-1') {
          clearTimeout(connectTimeout);
          if (frame.ok) {
            await this.persistDeviceToken(agent.id, frame.payload);
            this.persistGatewayPolicy(agent.id, frame.payload);
            this.startGatewayTickWatch(agent.id);
            this.states.set(agent.id, 'connected');
            this.emit({ type: 'connection_changed', agentId: agent.id, online: true });
            resolve();
          } else {
            const message = isObject(frame.error) && typeof frame.error.message === 'string'
              ? frame.error.message
              : 'OpenClaw Gateway connect failed';
            reject(new Error(message));
            ws.close();
          }
          return;
        }

        if (isObject(frame) && frame.type === 'res' && typeof frame.id === 'string') {
          const pending = this.pending.get(agent.id)?.get(frame.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pending.get(agent.id)?.delete(frame.id);
            if (frame.ok) pending.resolve(frame.payload);
            else pending.reject(new Error(isObject(frame.error) && typeof frame.error.message === 'string' ? frame.error.message : 'Gateway request failed'));
          }
          return;
        }

        const result = normalizer.normalize(frame);
        result.issues.forEach(issue => this.emit({
          type: 'transport_notice',
          level: issue.reason === 'server_error' ? 'error' : 'warning',
          message: issue.message,
        }));
        result.events.forEach(transportEvent => this.emit(transportEvent));
      };

      ws.onerror = () => {
        clearTimeout(connectTimeout);
        reject(new Error('OpenClaw Gateway socket error'));
      };

      ws.onclose = () => {
        clearTimeout(connectTimeout);
        this.stopGatewayTickWatch(agent.id);
        this.states.set(agent.id, 'disconnected');
        this.emit({ type: 'connection_changed', agentId: agent.id, online: false });
        const pending = this.pending.get(agent.id);
        pending?.forEach(request => {
          clearTimeout(request.timeout);
          request.reject(new Error('OpenClaw Gateway socket closed'));
        });
        pending?.clear();
      };
    });
  }


  private async persistDeviceToken(agentId: string, helloOk: unknown): Promise<void> {
    if (!isObject(helloOk) || !isObject(helloOk.auth) || typeof helloOk.auth.deviceToken !== 'string') return;
    await setGatewayDeviceToken(agentId, helloOk.auth.deviceToken);
  }

  private persistGatewayPolicy(agentId: string, helloOk: unknown): void {
    const policy = extractGatewayPolicy(helloOk);
    if (!policy) return;
    this.policies.set(agentId, policy);
  }

  private markGatewayActivity(agentId: string): void {
    this.lastGatewayActivityAt.set(agentId, Date.now());
  }

  private stopGatewayTickWatch(agentId: string): void {
    const watch = this.tickWatches.get(agentId);
    if (watch) clearInterval(watch);
    this.tickWatches.delete(agentId);
    this.lastGatewayActivityAt.delete(agentId);
  }

  private startGatewayTickWatch(agentId: string): void {
    this.stopGatewayTickWatch(agentId);

    const tickIntervalMs = this.policies.get(agentId)?.tickIntervalMs;
    if (!tickIntervalMs) return;

    this.lastGatewayActivityAt.set(agentId, Date.now());
    const intervalMs = Math.max(tickIntervalMs, 1_000);
    const timer = setInterval(() => {
      const ws = this.sockets.get(agentId);
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if ((this.pending.get(agentId)?.size ?? 0) > 0) return;

      const lastActivityAt = this.lastGatewayActivityAt.get(agentId);
      if (!lastActivityAt) return;

      if (Date.now() - lastActivityAt > tickIntervalMs * 2) {
        this.emit({
          type: 'transport_notice',
          level: 'warning',
          message: `OpenClaw Gateway tick timeout after ${tickIntervalMs * 2}ms without activity`,
        });
        ws.close(4000, 'tick timeout');
      }
    }, intervalMs);
    this.tickWatches.set(agentId, timer);
  }

  private validateOutboundFrame(agentId: string, frameJson: string): Error | null {
    const policy = this.policies.get(agentId);
    if (!policy) return null;

    const size = byteLength(frameJson);
    if (policy.maxPayload && size > policy.maxPayload) {
      return new Error(`Gateway frame is ${size} bytes, exceeding maxPayload ${policy.maxPayload}`);
    }

    const bufferedAmount = this.sockets.get(agentId)?.bufferedAmount ?? 0;
    if (policy.maxBufferedBytes && bufferedAmount + size > policy.maxBufferedBytes) {
      return new Error(`Gateway send buffer would exceed maxBufferedBytes ${policy.maxBufferedBytes}`);
    }

    return null;
  }

  private request(agentId: string, method: string, params: unknown): Promise<unknown> {
    const ws = this.sockets.get(agentId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('OpenClaw Gateway socket is not open'));

    const id = makeId();
    const frameJson = JSON.stringify({ type: 'req', id, method, params });
    const policyError = this.validateOutboundFrame(agentId, frameJson);
    if (policyError) {
      this.emit({ type: 'transport_notice', level: 'warning', message: policyError.message });
      return Promise.reject(policyError);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.get(agentId)?.delete(id);
        reject(new Error(`${method} timed out`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.get(agentId)?.set(id, { timeout, resolve, reject });
      ws.send(frameJson);
    });
  }

  disconnect(agentId: string): void {
    const ws = this.sockets.get(agentId);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    this.sockets.delete(agentId);
    this.pending.delete(agentId);
    this.normalizers.delete(agentId);
    this.policies.delete(agentId);
    this.stopGatewayTickWatch(agentId);
    this.subscribedThreads.delete(agentId);
    this.agents.delete(agentId);
    this.options.delete(agentId);
    this.deviceIds.delete(agentId);
    this.states.set(agentId, 'disconnected');
    this.emit({ type: 'connection_changed', agentId, online: false });
  }

  async revoke(agentId: string): Promise<void> {
    const deviceId = this.deviceIds.get(agentId);
    const ws = this.sockets.get(agentId);

    if (deviceId && ws?.readyState === WebSocket.OPEN) {
      try {
        await this.request(agentId, 'device.token.revoke', { deviceId, role: ROLE });
      } catch (err) {
        this.emit({
          type: 'transport_notice',
          level: 'warning',
          message: err instanceof Error
            ? `Could not revoke Gateway device token remotely: ${err.message}`
            : 'Could not revoke Gateway device token remotely',
        });
      }
    } else {
      this.emit({
        type: 'transport_notice',
        level: 'warning',
        message: 'Gateway device token removed locally; remote revocation needs a connected signed device identity',
      });
    }

    await deleteGatewayDeviceToken(agentId).catch(() => {});
    await deleteGatewayDeviceIdentitySeed(agentId).catch(() => {});
    this.disconnect(agentId);
  }

  private async ensureSubscribedToThread(agentId: string, threadId: string): Promise<void> {
    const subscribed = this.subscribedThreads.get(agentId) ?? new Set<string>();
    this.subscribedThreads.set(agentId, subscribed);
    if (subscribed.has(threadId)) return;

    try {
      await this.request(agentId, 'sessions.messages.subscribe', { key: threadId });
      subscribed.add(threadId);
    } catch (err) {
      this.emit({
        type: 'transport_notice',
        level: 'warning',
        message: err instanceof Error
          ? `Could not subscribe to Gateway session messages: ${err.message}`
          : 'Could not subscribe to Gateway session messages',
      });
    }
  }

  async sendMessage(agentId: string, threadId: string, text: string): Promise<void> {
    await this.ensureSubscribedToThread(agentId, threadId);
    await this.request(agentId, 'sessions.send', {
      key: threadId,
      message: text,
      idempotencyKey: makeId(),
    });
  }

  async resolveApproval(): Promise<void> {
    this.emit({
      type: 'transport_notice',
      level: 'warning',
      message: 'OpenClaw Gateway approval resolution is not implemented yet',
    });
  }

  async createThread(agentId: string, title?: string): Promise<Thread> {
    const payload = await this.request(agentId, 'sessions.create', {
      key: `clawface-${makeId()}`,
      label: title,
    });

    if (isObject(payload) && typeof payload.key === 'string') {
      await this.ensureSubscribedToThread(agentId, payload.key);

      return {
        id: payload.key,
        agentId,
        title: title ?? 'OpenClaw session',
        folder: null,
        updatedMin: 0,
        unread: 0,
        preview: '',
        messages: [],
        context: { agentSessionId: payload.key },
      };
    }

    throw new Error('Gateway sessions.create returned an unsupported payload');
  }
}
