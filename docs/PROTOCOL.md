# ClawFace Wire Protocol

Status: Draft
Protocol version: `0.4.0`
Created: 2026-04-27

This is the canonical wire-protocol contract for the current ClawFace local/direct WebSocket flow. Product architecture, trust boundaries, hosted relay responsibilities, and approval-safety requirements live in `docs/ARCHITECTURE.md`; this document only defines endpoint behaviour, message schemas, ordering, and current protocol intent.

Current implementation endpoints:

- `/pair` — one-shot pairing handshake
- `/agent` — persistent bidirectional agent control channel

All messages are UTF-8 JSON objects with a required string `type` field. Unknown message types are currently ignored by the dev server/client unless otherwise noted.

---

## 1. Pairing endpoint: `/pair`

Purpose: exchange a one-time pairing code plus client-generated key material for a session key. The session key is later used on `/agent`.

### Sequence

```text
Mobile client                                      Agent/dev server
     |                                                   |
     |  open ws://host:port/pair                         |
     |-------------------------------------------------->| 
     |                                                   |
     |  { type: 'pair', code, clientKey }                 |
     |-------------------------------------------------->| 
     |                                                   | validate one-time code
     |                                                   | consume code
     |                                                   | issue session key
     |                                                   |
     |  { type: 'session', sessionKey }                   |
     |<--------------------------------------------------| 
     |                                                   |
     |  close                                            |
     |-------------------------------------------------->| 
```

On failure, the server sends `error` and closes the socket.

### Pairing payload

The pairing QR/paste payload is not itself sent over WebSocket, but it bootstraps `/pair`.

```ts
interface PairingPayload {
  v: 1;
  host: string;
  port: number;
  fingerprint: string;
  code: string;
  name?: string;
  secure?: boolean;
}
```

Notes:

- `fingerprint` identifies the intended pairing server. The server must echo it in the `/pair` `session` response; the client must reject the session if it does not match the pairing payload.
- `secure` selects `wss` when true and `ws` otherwise.

### Client -> server messages

#### `pair`

```ts
interface PairRequest {
  type: 'pair';
  code: string;
  clientKey: string;
}
```

Fields:

- `code` — one-time code from the pairing payload.
- `clientKey` — 32-byte client-generated random value, hex-encoded by the current app.

Session derivation:

- The current dev server derives `sessionKey = HMAC-SHA256('dev-secret', clientKey)`. Production implementations should use an environment-specific secret and equivalent server-side key derivation so the issued session is bound to the initiating client.

### Server -> client messages

#### `session`

```ts
interface PairSessionResponse {
  type: 'session';
  sessionKey: string;
  fingerprint: string;
}
```

Fields:

- `sessionKey` — bearer credential used in the `/agent` `hello` message.
- `fingerprint` — server fingerprint echoed from the pairing payload. Clients must compare this with the payload fingerprint and abort pairing on mismatch.

#### `error`

```ts
interface ErrorMessage {
  type: 'error';
  error: string;
}
```

---

## 2. Agent endpoint: `/agent`

Purpose: persistent bidirectional channel for connection readiness, user messages, streamed agent replies, approval requests/decisions, thread creation, push-token registration, session revocation, and heartbeat.

### Ordering guarantees

- The server may send `ready` immediately after the socket opens.
- The client must send `hello` before any authenticated agent-control messages (`user_message`, `approval_decision`, `create_thread`, `register_push`, or `revoke_session`).
- `hello.clientVersion` is the protocol version. Current version is `0.4.0`.
- `message_delta` chunks for one response are sent in order on a single WebSocket connection.
- If a logical response is streamed with `message_delta`, a later final `message` for that same logical response must reuse the same id (`message.id === message_delta.msgId`) so clients can treat it as a finalize/upsert instead of a second message.
- A server must not emit deltas for one logical response and then emit a separate final `message` with a different id for that same response.
- The current protocol does not define cross-message total ordering, replay protection, or exactly-once delivery.
- Heartbeat is client-driven: client sends `ping`, server responds with `pong`.

### Client -> server messages

#### `hello`

```ts
interface HelloMessage {
  type: 'hello';
  sessionKey: string;
  clientVersion: '0.4.0' | string;
}
```

Fields:

- `sessionKey` — bearer credential from `/pair`.
- `clientVersion` — app protocol version; current implementation sends `0.4.0`.

#### `user_message`

```ts
interface UserMessageRequest {
  type: 'user_message';
  threadId: string;
  text: string;
  tempId: number;
}
```

Fields:

- `threadId` — target thread.
- `text` — user-authored message text.
- `tempId` — client-generated temporary message id used by current streaming deltas.

#### `approval_decision`

```ts
interface ApprovalDecisionRequest {
  type: 'approval_decision';
  threadId: string;
  msgId: number;
  reqId: string;
  decision: 'approved' | 'denied';
}
```

Fields:

- `threadId` — thread containing the approval request.
- `msgId` — approval message id being resolved.
- `reqId` — server-generated approval request id from the matching `approval_request`; used for replay/deduplication.
- `decision` — user decision.

Servers must process at most one decision for a given `reqId`. Duplicate decisions with the same `reqId` must be ignored.

#### `create_thread`

```ts
interface CreateThreadRequest {
  type: 'create_thread';
  agentId: string;
  title?: string;
  clientRequestId: string;
}
```

Fields:

- `agentId` — target paired agent.
- `title` — optional initial title.
- `clientRequestId` — opaque client request id echoed in the resulting `thread` response.

#### `register_push`

```ts
interface RegisterPushRequest {
  type: 'register_push';
  token: string;
}
```

Fields:

- `token` — Expo/native push token registered for this paired agent session.

#### `revoke_session`

```ts
interface RevokeSessionRequest {
  type: 'revoke_session';
}
```

Invalidates the session key authenticated by the earlier `hello` message. Servers must reject subsequent `hello` messages using the revoked key and should close the current socket after processing the revocation.

#### `ping`

```ts
interface PingMessage {
  type: 'ping';
}
```

### Server -> client messages

#### `ready`

```ts
interface ReadyMessage {
  type: 'ready';
}
```

Indicates the socket is open and the server is ready to receive `hello`.

#### `pong`

```ts
interface PongMessage {
  type: 'pong';
}
```

Response to client `ping`.

#### `message`

```ts
interface AgentMessageEvent {
  type: 'message';
  threadId: string;
  message: Message;
}
```

Fields:

- `threadId` — target thread.
- `message` — complete message object matching `data/seed.ts` `Message`.
- If this finalizes a response previously streamed with `message_delta`, `message.id` must equal the streamed `msgId`; clients should reconcile it as an upsert/finalization of the streamed message.

#### `message_delta`

```ts
interface AgentMessageDeltaEvent {
  type: 'message_delta';
  threadId: string;
  msgId: number;
  textDelta: string;
}
```

Fields:

- `threadId` — target thread.
- `msgId` — stable message id to upsert/append text into for the duration of a streamed logical response.
- `textDelta` — next text chunk.

A streamed response may either be represented entirely by deltas, or be finalized by a `message` with the same id. A final `message` with a different id represents a different message and must not be used to finalize the streamed response.

#### `approval_request`

```ts
interface ApprovalRequestEvent {
  type: 'approval_request';
  threadId: string;
  message: Message;
}
```

Fields:

- `threadId` — thread containing the request.
- `message` — approval message matching `data/seed.ts` `Message` with `role: 'approval'`, required `reqId`, optional `expiresAt`, and approval-specific fields (`tool`, `summary`, `risk`, `files`, `diff`, `status`).

The server must generate a fresh, unique `message.reqId` for each approval request. Clients must echo that value in `approval_decision.reqId`.
When present, `message.expiresAt` is a Unix timestamp in milliseconds. Clients should exclude expired pending approvals from badges/counts and should not submit decisions for expired requests.

#### `thread`

```ts
interface ThreadEvent {
  type: 'thread';
  thread: Thread;
  clientRequestId?: string;
}
```

Fields:

- `thread` — complete thread object matching `data/seed.ts` `Thread`.
- `clientRequestId` — echoed when the thread was created from `create_thread`.

#### `error`

```ts
interface ErrorMessage {
  type: 'error';
  error: string;
}
```

---

## 3. Type reference

The TypeScript definitions for app transport events and inbound server messages live in `services/transport/types.ts`.
