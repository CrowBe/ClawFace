import type { Agent, Thread, Message } from '@/data/seed';

export type TransportEvent =
  | { type: 'message_appended'; threadId: string; message: Message }
  | { type: 'message_upserted'; threadId: string; message: Message }
  | { type: 'approval_request'; threadId: string; message: Message }
  | { type: 'thread_updated'; thread: Thread }
  | { type: 'connection_changed'; agentId: string; online: boolean };

export type TransportEventType = TransportEvent['type'];

export type TransportListener<T extends TransportEvent = TransportEvent> = (event: T) => void;

export interface AgentTransport {
  connect(agent: Agent): Promise<void>;
  disconnect(agentId: string): void;
  sendMessage(threadId: string, text: string): Promise<void>;
  resolveApproval(threadId: string, msgId: number, decision: 'approved' | 'denied'): Promise<void>;
  createThread(agentId: string, title?: string): Promise<Thread>;
  subscribe(listener: TransportListener): () => void;
}
