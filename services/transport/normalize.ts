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
