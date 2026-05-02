export type {
  AgentTransport,
  TransportEvent,
  TransportEventType,
  TransportListener,
} from './types';
export { GatewayTransportEventNormalizer } from './normalize';
export type { GatewayFrame, TransportNormalizationIssue, TransportNormalizationResult } from './normalize';
export { OpenClawGatewayTransport } from './openclaw-gateway';
export type { GatewayDeviceIdentity } from './openclaw-gateway';

import { OpenClawGatewayTransport } from './openclaw-gateway';
import type { AgentTransport } from './types';
import type { Agent } from '@/data/seed';

export const openClawGatewayTransport = new OpenClawGatewayTransport();

export function resolveTransport(_agent: Agent): AgentTransport {
  return openClawGatewayTransport;
}
