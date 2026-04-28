# ClawFace Protocol Profile

Status: Draft
Profile revision: `0.6.0`
OpenClaw Gateway Protocol: `v3` for path B
Legacy bridge protocol: `0.5.0` for path A
Created: 2026-04-27
Updated: 2026-04-29

This document is now a **ClawFace profile/overlay**, not a complete parallel wire protocol. ClawFace's production-shaped OpenClaw path is to connect as an `operator` role client to the OpenClaw Gateway WebSocket Protocol. OpenClaw owns the Gateway frame format, handshake, authentication, method schemas, event schemas, scope checks, idempotency requirements, and device-token lifecycle.

Local OpenClaw reference: `/home/crowclaws/.npm-global/lib/node_modules/openclaw/docs/gateway/protocol.md`.

Product architecture, trust boundaries, hosted relay responsibilities, and approval-safety requirements live in `docs/ARCHITECTURE.md`. Product vocabulary lives in `docs/UBIQUITOUS_LANGUAGE.md`.

---

## 1. Transport paths

### Path B — OpenClaw Gateway Protocol profile

Path B is the long-term M1 shape: ClawFace connects directly to a locally-running or self-hosted OpenClaw Gateway, defaulting to `ws://127.0.0.1:18789`, as an `operator` role client over Gateway protocol v3.

ClawFace-specific responsibilities on this path:

- present a mobile command surface for an Agent Operator;
- request only the operator scopes needed for the current surface;
- persist Gateway-issued device tokens securely in the app when pairing is implemented;
- map Gateway sessions, topics, messages, tool events, and approvals onto ClawFace Workstreams, Threads, Agent Context, and Message models;
- keep OpenClaw identifiers opaque; ClawFace stores and routes with full IDs or separately-provided fields and must not derive meaning by delimiter parsing;
- normalize malformed or unsupported Gateway frames into controlled transport notices before touching app state.

OpenClaw-owned details that this document intentionally does **not** duplicate:

- `req` / `res` / `event` frame schemas;
- `connect.challenge` and `connect` request/response schema;
- device identity signature payloads and auth error detail codes;
- method parameter/response schemas;
- event payload schemas;
- server-side scope enforcement;
- device-token issuance, rotation, and revocation semantics.

### Path A — legacy ClawFace bridge/mock protocol

Path A remains for local development and for users running the `openclaw agent` CLI without a Gateway:

- `scripts/dev-server.js` — mock ClawFace dev server;
- `scripts/openclaw-bridge.js` — local CLI adapter that shells out to `openclaw agent`.

This protocol is still the contract for the currently shipped app transport in `services/transport/websocket.ts`, but it is now a legacy fallback rather than the target OpenClaw integration. Its last documented version is `0.5.0`; the preserved details are in [Appendix A](#appendix-a--legacy-path-a-bridge-and-mock-protocol-050).

---

## 2. Path B Gateway profile

### Connect handshake

ClawFace's Gateway client must wait for `event: "connect.challenge"`, then send a Gateway `req` with `method: "connect"` and protocol range `minProtocol: 3`, `maxProtocol: 3`.

Baseline connect intent:

- `role`: `operator`
- `client.id`: a ClawFace-specific client id such as `clawface-mobile` or `clawface-discover`
- `client.mode`: OpenClaw operator/client mode, not node mode
- `auth.token`: shared Gateway token or previously-issued device token when available
- `device`: signed device identity, including the challenge nonce, when required by Gateway auth mode

The first safe CF-025 slice includes a read-only discovery script (`scripts/openclaw-gateway-discover.js`) that validates this handshake shape without integrating app transport.

### Scope set

Minimum desired scopes by ClawFace surface:

| ClawFace surface | Gateway scope |
| --- | --- |
| Presence, available methods/events, health/status, session list/previews | `operator.read` |
| Send user turns, steer/abort where exposed in UI | `operator.write` |
| Resolve runtime approval/handoff requests | `operator.approvals` |
| Pair/revoke ClawFace device tokens | `operator.pairing` |
| Gateway/runtime administration | not part of M1; avoid by default |

The discovery script requests `operator.read` only. The eventual mobile transport should request the narrowest set needed for the enabled UI. `operator.admin` is not required for the M1 command surface and should not be a default.

### Gateway methods ClawFace expects to use

Known candidates from the local OpenClaw Gateway documentation:

| ClawFace need | Candidate Gateway method(s) | Status |
| --- | --- | --- |
| Discover Gateway health/status | `health`, `status` | Known read-only methods; exact payloads are OpenClaw-owned. |
| Discover connected devices/presence | `system-presence` | Known read-only method. |
| Discover sessions | `sessions.list`, `sessions.preview`, `sessions.get` | Known read-only methods. Payload shape is not duplicated here. |
| Subscribe to session index and messages | `sessions.subscribe`, `sessions.messages.subscribe` | Known methods; whether subscribe calls need idempotency or have side effects beyond this WS connection must be checked during app transport work. |
| Send a user turn | `sessions.send`, possibly `chat.send` depending on selected OpenClaw surface | Not implemented in this slice. Do not guess payload schema. |
| Steer/abort active work | `sessions.steer`, `sessions.abort`, `chat.abort` | Post-discovery until UX and method payloads are confirmed. |
| Resolve approvals | `exec.approval.resolve`, `plugin.approval.resolve` | Requires `operator.approvals`; payloads are OpenClaw-owned. |
| Revoke stored device token | `device.token.revoke` or related device-pairing method | Requires `operator.pairing`; exact self-revocation flow must be confirmed. |

Unknowns are intentional here: this slice does not implement message send, session subscriptions, approval resolution, or token storage. The app transport PR must inspect live `hello-ok.features.methods` and OpenClaw schemas before binding payloads.

### Gateway events ClawFace expects to consume

Known event families from OpenClaw docs:

| ClawFace model | Gateway event family |
| --- | --- |
| Agent reply/progress message | `session.message` and/or `chat`/`agent` events, depending on subscribed surface |
| Tool activity chips | `session.tool` and tool-result/agent event payloads |
| Session/workstream list updates | `sessions.changed` |
| Presence/agent availability | `presence`, `tick`, `health` |
| Exec approval cards | `exec.approval.requested`, `exec.approval.resolved` |
| Plugin approval cards | `plugin.approval.requested`, `plugin.approval.resolved` |

Payload shapes are not specified here because OpenClaw owns them. ClawFace's job is to normalize the subset it receives into app-domain events and surface unsupported/malformed frames as transport notices.

### ClawFace overlays

ClawFace adds product semantics on top of OpenClaw transport semantics:

- **Workstream**: ClawFace grouping for a bounded unit of work. OpenClaw may expose sessions/topics; ClawFace should not rename the wire IDs, but may present them inside a Workstream UX.
- **Thread**: ClawFace conversation/activity lane. A Thread may map to an OpenClaw session, topic, or separately-provided route.
- **Agent Context**: display metadata such as repo, branch, project, inbox, CRM workspace, session id, or topic id. ClawFace displays this context; it does not use it to infer routing by parsing IDs.
- **Handoff/Approval**: ClawFace UI cards for OpenClaw approval events. Runtime policy stays in OpenClaw.

### Identifier policy

OpenClaw identifiers are opaque strings. ClawFace must not split or interpret session keys, topic keys, device tokens, connection IDs, thread IDs, or request IDs using delimiters such as colon-separated segments or topic suffixes. If ClawFace needs separate route fields, it must consume separately-provided Gateway fields or preserve the full opaque identifier as one value.

### Idempotency and side effects

OpenClaw Gateway side-effecting methods require idempotency keys. The future app transport must send idempotency keys for methods such as message send, approval resolution, revoke/rotate, steer, abort, and any future write. This discovery slice intentionally avoids side-effecting probes.

### Candidate upstream OpenClaw helpers

Potential small upstream improvements for mobile UX, to validate after the first app transport spike:

- a mobile-oriented pairing payload/QR helper that bundles Gateway URL, expected auth mode, device approval guidance, and TLS fingerprint when applicable;
- documented minimal operator scope bundles for mobile read-only, mobile messaging, approvals, and pairing self-management;
- an explicit Agent Context summary shape suitable for mobile display, if `hello-ok.snapshot`, presence, and session previews do not already expose enough metadata;
- a push-notification bridge for approval/handoff events that carries only route metadata and no sensitive transcript content.

These are upstream OpenClaw proposals, not ClawFace-specific protocol forks.

---

## 3. Normalization policy

Inbound Gateway frames must pass through the ClawFace transport normalization seam before app/store updates.

- Unknown Gateway events are ignored or surfaced as transport notices; they must not crash the app.
- Unsupported but known event families should produce explicit unsupported notices during development.
- Malformed known frames should become `malformed` transport events.
- Complete messages and thread/session snapshots should be idempotent upserts keyed by opaque IDs.
- Streaming deltas must only append to the message/session route they belong to. If OpenClaw provides sequence numbers, ClawFace should use them; otherwise duplicates are handled as delivered.
- Approval/handoff requests are keyed by the opaque Gateway approval request id supplied by OpenClaw.

---

## 4. Type reference

Current app transport types live in `services/transport/types.ts`. The future Gateway transport should define a narrow ClawFace-side event union and reference OpenClaw-generated/schema-owned Gateway types where available instead of copying method payloads into this repository.

---

## Appendix A — legacy path A bridge and mock protocol `0.5.0`

The legacy ClawFace protocol uses JSON WebSocket messages with a required string `type` field.

Current legacy endpoints:

- `/pair` — one-shot pairing handshake;
- `/agent` — persistent bidirectional agent control channel.

### Legacy pairing `/pair`

Pairing QR/paste payload:

```ts
interface PairingPayload {
  v: 1;
  host: string;
  port: number;
  fingerprint: string;
  code: string;
  name?: string;
  secure?: boolean;
  context?: AgentContext;
}

interface AgentContext {
  repoPath?: string;
  repoName?: string;
  branch?: string;
  agentSessionId?: string;
  agentThreadId?: string;
}
```

Client sends:

```ts
interface PairRequest {
  type: 'pair';
  code: string;
  clientKey: string;
}
```

Server responds:

```ts
interface PairSessionResponse {
  type: 'session';
  sessionKey: string;
  fingerprint: string;
  context?: AgentContext;
}
```

The legacy dev server derives `sessionKey = HMAC-SHA256('dev-secret', clientKey)`. The OpenClaw bridge derives with its local fingerprint. The server must echo the expected `fingerprint`, and the app rejects mismatches.

### Legacy agent channel `/agent`

Ordering:

- server may send `ready` immediately;
- client must send `hello` before authenticated messages;
- legacy `hello.clientVersion` is `0.5.0`;
- `message_delta` chunks for one logical response are ordered on one socket;
- if finalized, the final `message.id` must match the streamed `msgId`;
- heartbeat is client-driven with `ping` / `pong`.

Client messages:

```ts
type LegacyClientMessage =
  | { type: 'hello'; sessionKey: string; clientVersion: '0.5.0' | string }
  | { type: 'user_message'; threadId: string; text: string; tempId: number }
  | { type: 'approval_decision'; threadId: string; msgId: number; reqId: string; decision: 'approved' | 'denied' }
  | { type: 'create_thread'; agentId: string; title?: string; clientRequestId: string }
  | { type: 'register_push'; token: string }
  | { type: 'revoke_session' }
  | { type: 'ping' };
```

Server messages:

```ts
type LegacyServerMessage =
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'message'; threadId: string; message: Message }
  | { type: 'message_delta'; threadId: string; msgId: number; textDelta: string }
  | { type: 'approval_request'; threadId: string; message: Message }
  | { type: 'thread'; thread: Thread; clientRequestId?: string }
  | { type: 'error'; error: string };
```

Legacy approvals use server-generated `message.reqId`; clients echo it in `approval_decision.reqId`. Servers process at most one decision per `reqId`.
