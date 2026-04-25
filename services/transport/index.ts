export type { AgentTransport, TransportEvent, TransportListener, TransportEventType } from './types';
export { MockTransport } from './mock';
export { WebSocketTransport } from './websocket';

import { MockTransport } from './mock';
import { WebSocketTransport } from './websocket';
import type { AgentTransport } from './types';
import type { Agent } from '@/data/seed';

export const mockTransport = new MockTransport();
export const wsTransport = new WebSocketTransport();

export function resolveTransport(agent: Agent): AgentTransport {
  if (agent.sessionKey) {
    return wsTransport;
  }
  return mockTransport;
}
