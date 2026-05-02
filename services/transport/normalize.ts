import type { Message } from '@/data/seed';
import type { TransportEvent } from './types';

export type TransportControlEvent =
  | { type: 'ready' }
  | { type: 'pong' };

export type TransportNormalizationIssueReason =
  | 'invalid_json'
  | 'malformed_message'
  | 'unknown_type'
  | 'server_error';

export interface TransportNormalizationIssue {
  reason: TransportNormalizationIssueReason;
  message: string;
  rawType?: string;
}

export interface TransportNormalizationResult {
  events: TransportEvent[];
  controls: TransportControlEvent[];
  issues: TransportNormalizationIssue[];
}

export type GatewayFrame =
  | { type: 'event'; event: string; payload?: unknown; seq?: number; stateVersion?: number }
  | { type: 'res'; id: string; ok: boolean; payload?: unknown; error?: unknown }
  | { type: 'req'; id: string; method: string; params?: unknown };

function emptyResult(): TransportNormalizationResult {
  return { events: [], controls: [], issues: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isGatewayFrame(value: unknown): value is GatewayFrame {
  if (!isObject(value) || !isString(value.type)) return false;
  if (value.type === 'event') return isString(value.event);
  if (value.type === 'res') return isString(value.id) && typeof value.ok === 'boolean';
  if (value.type === 'req') return isString(value.id) && isString(value.method);
  return false;
}

function stableNumericId(input: string): number {
  // ClawFace's current Message model uses numeric ids while OpenClaw Gateway ids
  // are opaque strings. Hash the full opaque value; never parse it by delimiter.
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function extractText(value: unknown): string | undefined {
  if (isString(value)) return value;
  if (!isObject(value)) return undefined;

  if (isString(value.text)) return value.text;
  if (isString(value.content)) return value.content;

  if (Array.isArray(value.content)) {
    const text = value.content
      .map(part => isObject(part) && isString(part.text) ? part.text : '')
      .join('');
    return text || undefined;
  }

  return undefined;
}


function normalizeGatewayMessageRole(value: unknown): Message['role'] | null {
  if (!isString(value)) return null;
  if (value === 'assistant') return 'agent';
  if (value === 'user' || value === 'tool') return value;
  return null;
}

function normalizeGatewaySessionMessage(payload: unknown): TransportNormalizationResult {
  if (!isObject(payload)) return malformed('session.message', 'Gateway session.message event requires an object payload');
  if (!isString(payload.sessionKey) || !isObject(payload.message)) {
    return malformed('session.message', 'Gateway session.message event requires sessionKey and message');
  }

  const role = normalizeGatewayMessageRole(payload.message.role);
  if (!role) return malformed('session.message', 'Gateway session.message message requires user, assistant, or tool role');

  const text = extractText(payload.message);
  if (!text && role !== 'tool') {
    return malformed('session.message', 'Gateway session.message requires text content');
  }

  const opaqueMessageId = isString(payload.messageId)
    ? payload.messageId
    : isString(payload.message.id)
      ? payload.message.id
      : isNumber(payload.messageSeq)
        ? String(payload.messageSeq)
        : `${payload.sessionKey}|${JSON.stringify(payload.message)}`;

  const message: Message = role === 'tool'
    ? {
        id: stableNumericId(`${payload.sessionKey}|${opaqueMessageId}`),
        role: 'tool',
        name: isString(payload.message.name) ? payload.message.name : 'tool',
        status: 'done',
        result: text,
        t: 'now',
      }
    : {
        id: stableNumericId(`${payload.sessionKey}|${opaqueMessageId}`),
        role,
        text,
        t: 'now',
      };

  return {
    controls: [],
    issues: [],
    events: [{ type: 'message_upserted', threadId: payload.sessionKey, message }],
  };
}

function normalizeGatewayChatEvent(payload: unknown): TransportNormalizationResult {
  if (!isObject(payload)) return malformed('chat', 'Gateway chat event requires an object payload');
  if (!isString(payload.runId) || !isString(payload.sessionKey) || !isNumber(payload.seq) || !isString(payload.state)) {
    return malformed('chat', 'Gateway chat event requires runId, sessionKey, seq, and state');
  }

  const threadId = payload.sessionKey;
  const messageId = stableNumericId(`${payload.sessionKey}|${payload.runId}`);

  if (payload.state === 'delta' || payload.state === 'final') {
    const text = extractText(payload.message);
    if (!text && payload.state === 'delta') {
      return malformed('chat', 'Gateway chat delta requires text content');
    }

    return {
      controls: [],
      issues: [],
      events: text ? [{
        // OpenClaw chat deltas carry the current buffered assistant text, not
        // just the incremental suffix. Upsert so the store replaces the partial
        // text instead of appending duplicate prefixes.
        type: 'message_upserted',
        threadId,
        message: { id: messageId, role: 'agent', text, t: 'now' },
      }] : [],
    };
  }

  if (payload.state === 'aborted') {
    return {
      controls: [],
      events: [],
      issues: [{ reason: 'server_error', rawType: 'chat', message: 'Gateway chat run was aborted' }],
    };
  }

  if (payload.state === 'error') {
    return {
      controls: [],
      events: [],
      issues: [{
        reason: 'server_error',
        rawType: 'chat',
        message: isString(payload.errorMessage) ? payload.errorMessage : 'Gateway chat run failed',
      }],
    };
  }

  return malformed('chat', `Unsupported Gateway chat state: ${payload.state}`);
}

function normalizeGatewayAgentEvent(payload: unknown): TransportNormalizationResult {
  if (!isObject(payload)) return malformed('agent', 'Gateway agent event requires an object payload');
  if (!isString(payload.runId) || !isNumber(payload.seq) || !isString(payload.stream) || !isNumber(payload.ts)) {
    return malformed('agent', 'Gateway agent event requires runId, seq, stream, and ts');
  }
  if (!isString(payload.sessionKey)) {
    return malformed('agent', 'Gateway agent event requires sessionKey for ClawFace thread routing');
  }

  if (payload.stream === 'assistant') return normalizeGatewayAgentAssistant(payload);
  if (payload.stream === 'tool') return normalizeGatewayAgentTool(payload);
  if (payload.stream === 'command_output') return normalizeGatewayAgentCommandOutput(payload);

  return {
    controls: [],
    events: [],
    issues: [{
      reason: 'unknown_type',
      rawType: 'agent',
      message: `Unsupported Gateway agent stream: ${payload.stream}`,
    }],
  };
}

function normalizeGatewayAgentAssistant(payload: Record<string, unknown>): TransportNormalizationResult {
  if (!isObject(payload.data)) return malformed('agent', 'Gateway assistant agent stream requires data');

  const text = extractText(payload.data);
  if (!text) return malformed('agent', 'Gateway assistant agent stream requires text content');

  return {
    controls: [],
    issues: [],
    events: [{
      type: 'message_upserted',
      threadId: payload.sessionKey as string,
      message: {
        id: stableNumericId(`${payload.sessionKey}|${payload.runId}|assistant`),
        role: 'agent',
        text,
        t: 'now',
      },
    }],
  };
}

function normalizeGatewayAgentTool(payload: Record<string, unknown>): TransportNormalizationResult {
  if (!isObject(payload.data)) return malformed('agent', 'Gateway tool agent stream requires data');
  if (!isString(payload.data.toolCallId) || !isString(payload.data.phase)) {
    return malformed('agent', 'Gateway tool agent stream requires toolCallId and phase');
  }

  const phase = payload.data.phase;
  const status = phase === 'start' || phase === 'update'
    ? 'running'
    : phase === 'result'
      ? (payload.data.isError ? 'failed' : 'done')
      : undefined;
  if (!status) return malformed('agent', `Unsupported Gateway tool agent stream phase: ${phase}`);

  const message: Message = {
    id: stableNumericId(`${payload.sessionKey}|${payload.data.toolCallId}`),
    role: 'tool',
    name: isString(payload.data.name) ? payload.data.name : 'tool',
    arg: stringifyToolValue(payload.data.args),
    status,
    result: stringifyToolValue(payload.data.result ?? payload.data.partialResult),
    t: 'now',
  };

  return {
    controls: [],
    issues: [],
    events: [{ type: 'message_upserted', threadId: payload.sessionKey as string, message }],
  };
}

function normalizeGatewayAgentCommandOutput(payload: Record<string, unknown>): TransportNormalizationResult {
  if (!isObject(payload.data)) return malformed('agent', 'Gateway command_output agent stream requires data');
  if (!isString(payload.data.toolCallId)) {
    return malformed('agent', 'Gateway command_output agent stream requires toolCallId');
  }

  const message: Message = {
    id: stableNumericId(`${payload.sessionKey}|${payload.data.toolCallId}`),
    role: 'tool',
    name: isString(payload.data.name) ? payload.data.name : 'command',
    status: payload.data.status === 'failed' ? 'failed' : 'running',
    result: stringifyToolValue(payload.data.output ?? payload.data.progressText),
    t: 'now',
  };

  return {
    controls: [],
    issues: [],
    events: [{ type: 'message_upserted', threadId: payload.sessionKey as string, message }],
  };
}

function stringifyToolValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (isString(value)) return value;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function normalizeGatewaySessionTool(payload: unknown): TransportNormalizationResult {
  if (!isObject(payload)) return malformed('session.tool', 'Gateway session.tool event requires an object payload');
  if (!isString(payload.sessionKey) || !isObject(payload.data)) {
    return malformed('session.tool', 'Gateway session.tool event requires sessionKey and data');
  }
  if (!isString(payload.data.toolCallId) || !isString(payload.data.phase)) {
    return malformed('session.tool', 'Gateway session.tool data requires toolCallId and phase');
  }

  const phase = payload.data.phase;
  const status = phase === 'start' || phase === 'update'
    ? 'running'
    : phase === 'result'
      ? (payload.data.isError ? 'failed' : 'done')
      : undefined;
  if (!status) return malformed('session.tool', `Unsupported Gateway session.tool phase: ${phase}`);

  const result = stringifyToolValue(payload.data.result ?? payload.data.partialResult);
  const message: Message = {
    id: stableNumericId(`${payload.sessionKey}|${payload.data.toolCallId}`),
    role: 'tool',
    name: isString(payload.data.name) ? payload.data.name : 'tool',
    arg: stringifyToolValue(payload.data.args),
    status,
    result,
    t: 'now',
  };

  return {
    controls: [],
    issues: [],
    events: [{ type: 'message_upserted', threadId: payload.sessionKey, message }],
  };
}

function malformed(rawType: string | undefined, message: string): TransportNormalizationResult {
  return {
    events: [],
    controls: [],
    issues: [{ reason: 'malformed_message', rawType, message }],
  };
}

export class GatewayTransportEventNormalizer {
  normalize(raw: unknown): TransportNormalizationResult {
    if (!isGatewayFrame(raw)) {
      return malformed(undefined, 'Gateway frame must be a valid req/res/event object');
    }

    if (raw.type === 'event') {
      switch (raw.event) {
        case 'chat':
          return normalizeGatewayChatEvent(raw.payload);
        case 'agent':
          return normalizeGatewayAgentEvent(raw.payload);
        case 'session.message':
          return normalizeGatewaySessionMessage(raw.payload);
        case 'session.tool':
          return normalizeGatewaySessionTool(raw.payload);
        case 'heartbeat':
        case 'tick':
        case 'presence':
        case 'sessions.changed':
          return emptyResult();
        default:
          return {
            controls: [],
            events: [],
            issues: [{ reason: 'unknown_type', rawType: raw.event, message: `Ignoring unknown Gateway event: ${raw.event}` }],
          };
      }
    }

    // Request/response frames are handled by the Gateway transport request
    // table. This normalizer is intentionally only for broadcast events that
    // flow into app state.
    return emptyResult();
  }

  normalizeJson(data: string): TransportNormalizationResult {
    try {
      return this.normalize(JSON.parse(data) as unknown);
    } catch {
      return {
        events: [],
        controls: [],
        issues: [{ reason: 'invalid_json', message: 'Ignoring non-JSON Gateway frame' }],
      };
    }
  }
}
