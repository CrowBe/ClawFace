import type { Agent, AgentContext, Thread, Message } from '@/data/seed';

export type TransportEvent =
  | { type: 'message_appended'; threadId: string; message: Message }
  | { type: 'message_delta_appended'; threadId: string; message: Message }
  | { type: 'message_upserted'; threadId: string; message: Message }
  | { type: 'approval_request'; threadId: string; message: Message; replay?: boolean }
  | { type: 'thread_updated'; thread: Thread; clientRequestId?: string }
  | { type: 'connection_changed'; agentId: string; online: boolean }
  | { type: 'agent_context_updated'; agentId: string; context: AgentContext }
  | { type: 'transport_notice'; level: 'info' | 'warning' | 'error'; message: string };

export type TransportEventType = TransportEvent['type'];

export type ServerMessage =
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'message'; threadId: string; message: Message }
  | { type: 'message_delta'; threadId: string; msgId: number; textDelta: string }
  | { type: 'approval_request'; threadId: string; message: Message }
  | { type: 'thread'; thread: Thread; clientRequestId?: string }
  | { type: 'error'; error: string };

export type ClientMessage =
  | { type: 'hello'; sessionKey: string; clientVersion: string }
  | { type: 'user_message'; threadId: string; text: string; tempId: number }
  | { type: 'approval_decision'; threadId: string; msgId: number; reqId: string; decision: 'approved' | 'denied' }
  | { type: 'create_thread'; agentId: string; title?: string; clientRequestId: string }
  | { type: 'register_push'; token: string }
  | { type: 'revoke_session' }
  | { type: 'ping' };

export type PairClientMessage = { type: 'pair'; code: string; clientKey: string };

export type PairServerMessage =
  | { type: 'session'; sessionKey: string; fingerprint: string; context?: AgentContext }
  | { type: 'error'; error: string };

export type TransportListener<T extends TransportEvent = TransportEvent> = (event: T) => void;

export interface AgentTransport {
  connect(agent: Agent): Promise<void>;
  revoke(agentId: string): Promise<void>;
  disconnect(agentId: string): void;
  sendMessage(agentId: string, threadId: string, text: string): Promise<void>;
  resolveApproval(agentId: string, threadId: string, msgId: number, reqId: string, decision: 'approved' | 'denied'): Promise<void>;
  createThread(agentId: string, title?: string): Promise<Thread>;
  subscribe(listener: TransportListener): () => void;
}
