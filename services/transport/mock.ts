import type { Agent, Thread, Message } from '@/data/seed';
import type { AgentTransport, TransportListener, TransportEvent } from './types';

export class MockTransport implements AgentTransport {
  private listeners: Set<TransportListener> = new Set();

  private emit(event: TransportEvent) {
    this.listeners.forEach(l => l(event));
  }

  subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(agent: Agent): Promise<void> {
    this.emit({ type: 'connection_changed', agentId: agent.id, online: true });
  }

  disconnect(agentId: string): void {
    this.emit({ type: 'connection_changed', agentId, online: false });
  }

  async sendMessage(_agentId: string, threadId: string, text: string): Promise<void> {
    setTimeout(() => {
      const msg: Message = {
        id: Date.now() + 1,
        role: 'agent',
        text: 'Got it — on it.',
        t: 'now',
      };
      this.emit({ type: 'message_appended', threadId, message: msg });
    }, 900);
  }

  async resolveApproval(_agentId: string, threadId: string, _msgId: number, _reqId: string, decision: 'approved' | 'denied'): Promise<void> {
    const msg: Message = {
      id: Date.now(),
      role: 'agent',
      text: decision === 'approved' ? 'Approved — running now.' : 'Canceled. Let me know what to change.',
      t: 'just now',
    };
    this.emit({ type: 'message_appended', threadId, message: msg });
  }

  async createThread(agentId: string, title?: string): Promise<Thread> {
    const thread: Thread = {
      id: `${agentId}-${Date.now()}`,
      agentId,
      title: title ?? 'New thread',
      folder: null,
      updatedMin: 0,
      unread: 0,
      preview: '',
      messages: [],
    };
    this.emit({ type: 'thread_updated', thread });
    return thread;
  }
}
