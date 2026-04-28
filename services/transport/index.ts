export type {
  AgentTransport,
  ClientMessage,
  PairClientMessage,
  PairServerMessage,
  ServerMessage,
  TransportEvent,
  TransportEventType,
  TransportListener,
} from './types';
export { MockTransport } from './mock';
export { GatewayTransportEventNormalizer, TransportEventNormalizer } from './normalize';
export type { GatewayFrame, TransportNormalizationIssue, TransportNormalizationResult } from './normalize';
export { OpenClawGatewayTransport } from './openclaw-gateway';
export type { GatewayDeviceIdentity } from './openclaw-gateway';
export { WebSocketTransport } from './websocket';

import { MockTransport } from './mock';
import { WebSocketTransport } from './websocket';
import type { AgentTransport } from './types';
import type { Agent } from '@/data/seed';

export const mockTransport = new MockTransport();
export const wsTransport = new WebSocketTransport();

export function resolveTransport(agent: Agent): AgentTransport {
  const mode = agent.mode ?? 'direct';

  if (mode === 'relay') {
    console.warn('Relay transport is not implemented yet; falling back to WebSocket transport.');
    return wsTransport;
  }

  if (agent.sessionKey) {
    return wsTransport;
  }
  return mockTransport;
}
