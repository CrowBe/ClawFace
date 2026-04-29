import type { Message, Thread } from '@/data/seed';
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

const VALID_MESSAGE_ROLES = new Set(['user', 'agent', 'tool', 'approval']);

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
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

function isMessage(value: unknown): value is Message {
  if (!isObject(value)) return false;
  if (!isNumber(value.id)) return false;
  if (!isString(value.role) || !VALID_MESSAGE_ROLES.has(value.role)) return false;
  if (value.text != null && !isString(value.text)) return false;
  if (value.reqId != null && !isString(value.reqId)) return false;
  if (value.expiresAt != null && !isNumber(value.expiresAt)) return false;
  if (value.files != null && !isStringArray(value.files)) return false;
  return true;
}

function isApprovalMessage(value: unknown): value is Message {
  return isMessage(value)
    && value.role === 'approval'
    && isString(value.reqId);
}

function isThread(value: unknown): value is Thread {
  if (!isObject(value)) return false;
  return isString(value.id)
    && isString(value.agentId)
    && isString(value.title)
    && (value.folder === null || isString(value.folder))
    && isNumber(value.updatedMin)
    && isNumber(value.unread)
    && isString(value.preview)
    && Array.isArray(value.messages)
    && value.messages.every(isMessage);
}

function malformed(rawType: string | undefined, message: string): TransportNormalizationResult {
  return {
    events: [],
    controls: [],
    issues: [{ reason: 'malformed_message', rawType, message }],
  };
}

export class TransportEventNormalizer {
  private seenApprovalReqIds = new Set<string>();

  normalize(raw: unknown): TransportNormalizationResult {
    const out = emptyResult();

    if (!isObject(raw) || !isString(raw.type)) {
      return malformed(undefined, 'Server message must be an object with a string type');
    }

    switch (raw.type) {
      case 'ready':
        out.controls.push({ type: 'ready' });
        return out;

      case 'pong':
        out.controls.push({ type: 'pong' });
        return out;

      case 'message': {
        if (!isString(raw.threadId) || !isMessage(raw.message)) {
          return malformed(raw.type, 'message event requires threadId and a valid message');
        }

        // Final messages are idempotent upserts. If this id was previously streamed
        // with message_delta, the store replaces the partial message instead of
        // appending the final text a second time.
        out.events.push({ type: 'message_upserted', threadId: raw.threadId, message: raw.message });
        return out;
      }

      case 'message_delta': {
        if (!isString(raw.threadId) || !isNumber(raw.msgId) || !isString(raw.textDelta)) {
          return malformed(raw.type, 'message_delta event requires threadId, msgId, and textDelta');
        }

        out.events.push({
          type: 'message_delta_appended',
          threadId: raw.threadId,
          message: { id: raw.msgId, role: 'agent', text: raw.textDelta, t: 'now' },
        });
        return out;
      }

      case 'approval_request': {
        if (!isString(raw.threadId) || !isApprovalMessage(raw.message)) {
          return malformed(raw.type, 'approval_request event requires threadId and an approval message with reqId');
        }

        const reqId = raw.message.reqId;
        if (!isString(reqId)) {
          return malformed(raw.type, 'approval_request event requires approval message reqId');
        }

        const replay = this.seenApprovalReqIds.has(reqId);
        this.seenApprovalReqIds.add(reqId);
        // Approval/handoff requests are keyed by reqId. Replays update the existing
        // handoff state and must not create duplicate pending requests.
        out.events.push({ type: 'approval_request', threadId: raw.threadId, message: raw.message, replay });
        return out;
      }

      case 'thread': {
        if (!isThread(raw.thread)) {
          return malformed(raw.type, 'thread event requires a valid thread');
        }

        out.events.push({
          type: 'thread_updated',
          thread: raw.thread,
          clientRequestId: isString(raw.clientRequestId) ? raw.clientRequestId : undefined,
        });
        return out;
      }

      case 'error': {
        out.issues.push({
          reason: 'server_error',
          rawType: raw.type,
          message: isString(raw.error) ? raw.error : 'Server reported an error',
        });
        return out;
      }

      default:
        out.issues.push({ reason: 'unknown_type', rawType: raw.type, message: `Ignoring unknown server message type: ${raw.type}` });
        return out;
    }
  }

  normalizeJson(data: string): TransportNormalizationResult {
    try {
      return this.normalize(JSON.parse(data) as unknown);
    } catch {
      return {
        events: [],
        controls: [],
        issues: [{ reason: 'invalid_json', message: 'Ignoring non-JSON server message' }],
      };
    }
  }
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
