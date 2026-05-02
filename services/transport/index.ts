export type {
  AgentTransport,
  TransportEvent,
  TransportEventType,
  TransportListener,
} from './types';
export { MockTransport } from './mock';
export { GatewayTransportEventNormalizer } from './normalize';
export type { GatewayFrame, TransportNormalizationIssue, TransportNormalizationResult } from './normalize';
export { OpenClawGatewayTransport } from './openclaw-gateway';
export type { GatewayDeviceIdentity } from './openclaw-gateway';

import { MockTransport } from './mock';
import { OpenClawGatewayTransport } from './openclaw-gateway';
import type { AgentTransport } from './types';
import type { Agent } from '@/data/seed';

export const mockTransport = new MockTransport();
export const openClawGatewayTransport = new OpenClawGatewayTransport();

export function resolveTransport(agent: Agent): AgentTransport {
  if (agent.transport === 'openclaw-gateway') {
    return openClawGatewayTransport;
  }

  return mockTransport;
}
