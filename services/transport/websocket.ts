import type { Agent, Thread, Message } from '@/data/seed';
import type { AgentTransport, TransportListener, TransportEvent } from './types';

type SocketState = 'disconnected' | 'connecting' | 'connected';

interface OutboundMessage {
  payload: string;
}

interface PendingThreadRequest {
  agentId: string;
  timeout: ReturnType<typeof setTimeout>;
  resolve: (thread: Thread) => void;
  reject: (error: Error) => void;
}

const HEARTBEAT_INTERVAL_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_AGENT_PORT = 8765;
const THREAD_CREATE_TIMEOUT_MS = 8_000;

function buildWsUrl(host: string, port: number | undefined, path: string, secure?: boolean): string {
  const protocol = secure ? 'wss' : 'ws';
  const normalizedHost = host
    .replace(/^wss?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:$/, '');
  const hasPort = /:\d+$/.test(normalizedHost);
  const authority = hasPort ? normalizedHost : `${normalizedHost}:${port ?? DEFAULT_AGENT_PORT}`;
  return `${protocol}://${authority}${path.startsWith('/') ? path : `/${path}`}`;
}

export class WebSocketTransport implements AgentTransport {
  private sockets = new Map<string, WebSocket>();
  private states = new Map<string, SocketState>();
  private agents = new Map<string, Agent>();
  private listeners: Set<TransportListener> = new Set();
  private heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private pongPending = new Map<string, boolean>();
  private reconnectAttempts = new Map<string, number>();
  private outboundBuffers = new Map<string, OutboundMessage[]>();
  private sessionKeys = new Map<string, string>();
  private pendingThreadRequests = new Map<string, PendingThreadRequest>();

  subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: TransportEvent) {
    this.listeners.forEach(l => l(event));
  }

  setSessionKey(agentId: string, key: string) {
    this.sessionKeys.set(agentId, key);
  }

  async connect(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
    this.states.set(agent.id, 'connecting');
    this._openSocket(agent.id);
  }

  private _openSocket(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const sessionKey = this.sessionKeys.get(agentId) ?? agent.sessionKey ?? '';
    const url = buildWsUrl(agent.host, agent.port, '/agent', agent.secure);
    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect(agentId);
      return;
    }

    this.sockets.set(agentId, ws);

    ws.onopen = () => {
      this.states.set(agentId, 'connected');
      this.reconnectAttempts.set(agentId, 0);
      ws.send(JSON.stringify({ type: 'hello', sessionKey, clientVersion: '0.4.0' }));
      this._startHeartbeat(agentId);
      this._flushBuffer(agentId);
      this.emit({ type: 'connection_changed', agentId, online: true });
    };

    ws.onmessage = (event) => {
      this._handleMessage(agentId, event.data as string);
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      this._stopHeartbeat(agentId);
      this.states.set(agentId, 'disconnected');
      this.emit({ type: 'connection_changed', agentId, online: false });
      this._scheduleReconnect(agentId);
    };
  }

  private _handleMessage(agentId: string, data: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'ready':
        break;
      case 'pong':
        this.pongPending.set(agentId, false);
        break;
      case 'message': {
        const threadId = msg.threadId as string;
        const message = msg.message as Message;
        this.emit({ type: 'message_upserted', threadId, message });
        break;
      }
      case 'message_delta': {
        const threadId = msg.threadId as string;
        const msgId = msg.msgId as number;
        const textDelta = msg.textDelta as string;
        const deltaMsg: Message = { id: msgId, role: 'agent', text: textDelta, t: 'now' };
        this.emit({ type: 'message_upserted', threadId, message: deltaMsg });
        break;
      }
      case 'approval_request': {
        const threadId = msg.threadId as string;
        const message = msg.message as Message;
        this.emit({ type: 'approval_request', threadId, message });
        break;
      }
      case 'thread': {
        const thread = msg.thread as Thread;
        const clientRequestId = msg.clientRequestId as string | undefined;
        if (clientRequestId) {
          const pending = this.pendingThreadRequests.get(clientRequestId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingThreadRequests.delete(clientRequestId);
            pending.resolve(thread);
          }
        }
        this.emit({ type: 'thread_updated', thread });
        break;
      }
      case 'error':
        break;
    }
  }

  private _startHeartbeat(agentId: string) {
    const timer = setInterval(() => {
      const ws = this.sockets.get(agentId);
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (this.pongPending.get(agentId)) {
        ws.close();
        return;
      }

      this.pongPending.set(agentId, true);
      ws.send(JSON.stringify({ type: 'ping' }));
    }, HEARTBEAT_INTERVAL_MS);

    this.heartbeatTimers.set(agentId, timer);
  }

  private _stopHeartbeat(agentId: string) {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(agentId);
    }
    this.pongPending.delete(agentId);
  }

  private _scheduleReconnect(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const attempts = (this.reconnectAttempts.get(agentId) ?? 0) + 1;
    this.reconnectAttempts.set(agentId, attempts);

    const delay = Math.min(1000 * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
    setTimeout(() => {
      if (this.agents.has(agentId)) {
        this._openSocket(agentId);
      }
    }, delay);
  }

  private _flushBuffer(agentId: string) {
    const buf = this.outboundBuffers.get(agentId) ?? [];
    const ws = this.sockets.get(agentId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    buf.forEach(m => ws.send(m.payload));
    this.outboundBuffers.set(agentId, []);
  }

  private _send(agentId: string, payload: object) {
    const ws = this.sockets.get(agentId);
    const str = JSON.stringify(payload);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(str);
    } else {
      const buf = this.outboundBuffers.get(agentId) ?? [];
      buf.push({ payload: str });
      this.outboundBuffers.set(agentId, buf);
    }
  }

  disconnect(agentId: string): void {
    this._stopHeartbeat(agentId);
    const ws = this.sockets.get(agentId);
    if (ws) {
      ws.onclose = null;
      ws.close();
      this.sockets.delete(agentId);
    }
    this.agents.delete(agentId);
    this.sessionKeys.delete(agentId);
    this.states.set(agentId, 'disconnected');
    this.emit({ type: 'connection_changed', agentId, online: false });
  }

  async revoke(agentId: string): Promise<void> {
    const ws = this.sockets.get(agentId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'revoke_session' }));
    }
    this.disconnect(agentId);
  }

  async sendMessage(agentId: string, threadId: string, text: string): Promise<void> {
    const tempId = Date.now();
    this._send(agentId, { type: 'user_message', threadId, text, tempId });
  }

  async resolveApproval(agentId: string, threadId: string, msgId: number, reqId: string, decision: 'approved' | 'denied'): Promise<void> {
    this._send(agentId, { type: 'approval_decision', threadId, msgId, reqId, decision });
  }

  async createThread(agentId: string, title?: string): Promise<Thread> {
    const clientRequestId = `${agentId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    return new Promise<Thread>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingThreadRequests.delete(clientRequestId);
        reject(new Error('Timed out waiting for thread creation'));
      }, THREAD_CREATE_TIMEOUT_MS);

      this.pendingThreadRequests.set(clientRequestId, { agentId, timeout, resolve, reject });
      this._send(agentId, { type: 'create_thread', agentId, title, clientRequestId });
    });
  }
}
