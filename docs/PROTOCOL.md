# ClawFace Protocol Profile

Status: Draft
Profile revision: `0.7.0`
OpenClaw Gateway Protocol: `v3` for path B
Legacy bridge protocol: `0.5.0` for path A
Created: 2026-04-27
Updated: 2026-04-29
Transport investigation: 2026-04-29

This document is now a **ClawFace profile/overlay**, not a complete parallel wire protocol. ClawFace's production-shaped OpenClaw path is to connect as an `operator` role client to the OpenClaw Gateway WebSocket Protocol. OpenClaw owns the Gateway frame format, handshake, authentication, method schemas, event schemas, scope checks, idempotency requirements, and device-token lifecycle.

Local OpenClaw reference: `/home/crowclaws/.npm-global/lib/node_modules/openclaw/docs/gateway/protocol.md`.

Product architecture, trust boundaries, hosted relay responsibilities, and approval-safety requirements live in `docs/ARCHITECTURE.md`. Product vocabulary lives in `docs/UBIQUITOUS_LANGUAGE.md`.

---

## 1. Transport paths

### Path B — OpenClaw Gateway Protocol profile

Path B is the long-term M1 shape: ClawFace connects directly to a locally-running or self-hosted OpenClaw Gateway, defaulting to `ws://127.0.0.1:18789`, as an `operator` role client over Gateway protocol v3.

OpenClaw's Gateway WebSocket Protocol is the **single** control-plane and node transport for all OpenClaw clients (CLI, web UI, macOS app, iOS/Android nodes, headless nodes). The legacy TCP bridge has been removed from OpenClaw; `bridge.*` config keys are no longer in the Gateway schema. All current and future OpenClaw clients connect over this same WebSocket surface. ClawFace does not need to patch, fork, or extend OpenClaw to connect — it uses the existing Gateway exactly as the CLI, web UI, and macOS app do.

Reference: https://docs.openclaw.ai/gateway/protocol/

ClawFace-specific responsibilities on this path:

- present a mobile command surface for an Agent Operator;
- request only the operator scopes needed for the current surface;
- persist Gateway-issued device tokens securely in the app when pairing is implemented;
- map Gateway sessions, topics, messages, tool events, and approvals onto ClawFace Workstreams, Threads, Agent Context, and Message models;
- keep OpenClaw identifiers opaque; ClawFace stores and routes with full IDs or separately-provided fields and must not derive meaning by delimiter parsing;
- normalize malformed or unsupported Gateway frames into controlled transport notices before touching app state;
- respect `hello-ok.policy` limits (`maxPayload`, `maxBufferedBytes`, `tickIntervalMs`) for transport hygiene.

OpenClaw-owned details that this document intentionally does **not** duplicate:

- `req` / `res` / `event` frame schemas;
- `connect.challenge` and `connect` request/response schema;
- device identity signature payloads and auth error detail codes;
- method parameter/response schemas;
- event payload schemas;
- server-side scope enforcement;
- device-token issuance, rotation, and revocation semantics;
- Bonjour/mDNS service advertisement and TXT record schemas;
- auth mode configuration (`token`, `password`, `trusted-proxy`, `tailscale`, `none`).

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
- `client.id`: an OpenClaw-accepted client id. The current app transport and discovery helper use the built-in `openclaw-probe` id. OpenClaw validates `client.id` against a built-in enum; known accepted values include `cli`, `ui`, `webchat`, `gateway-client`, `openclaw-probe`, and `ios-node`. A first-class `clawface-mobile` id is a candidate upstream request (see §2.7).
- `client.mode`: an OpenClaw-accepted non-node mode. The current transport uses `probe`. Known accepted operator modes include `operator`, `cli`, `ui`, `webchat`, `backend`, `probe`, and `test`. Presence entries are skipped for `cli` mode to avoid noise; `probe` mode may receive similar treatment. A mobile-appropriate mode is a candidate upstream request (see §2.7).
- `auth.token`: shared Gateway token, bootstrap token from an OpenClaw pairing flow, or previously-issued device token. OpenClaw accepts all three through the same `connect.params.auth.token` field. No OpenClaw-side patching is required for ClawFace to authenticate.
- `device`: signed device identity, including the challenge nonce, when required by Gateway auth mode. The v3 signature payload format is: `v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily`. The discovery script (`scripts/openclaw-gateway-discover.js`) demonstrates the complete Ed25519 signing flow. Mobile device signing is wired: ClawFace persists a per-agent Ed25519 seed in SecureStore and signs the Gateway v3 challenge payload while still accepting Gateway-issued token/device-token auth.

The read-only discovery script (`scripts/openclaw-gateway-discover.js`) validates this handshake shape. It probes `sessions.preview` only with keys returned by `sessions.list`, avoiding invalid empty-key requests. The app transport (`services/transport/openclaw-gateway.ts`) implements challenge handling, mobile Ed25519 device signing, and token/device-token authentication with SecureStore persistence.

### Scope set

Minimum desired scopes by ClawFace surface:

| ClawFace surface | Gateway scope |
| --- | --- |
| Presence, available methods/events, health/status, session list/previews | `operator.read` |
| Send user turns, steer/abort where exposed in UI | `operator.write` |
| Resolve runtime approval/handoff requests | `operator.approvals` |
| Pair/revoke ClawFace device tokens | `operator.pairing` |
| Access secret-bearing `talk.config` | `operator.talk.secrets` (not needed for M1 command surface) |
| Gateway/runtime administration | `operator.admin` — not part of M1; avoid by default |

The discovery script defaults to `operator.read`. Set `OPENCLAW_GATEWAY_PRINT_FULL_FEATURES=1` to print the full advertised method/event list, or `OPENCLAW_GATEWAY_SCOPES=operator.read,operator.write,operator.pairing,operator.approvals` to inspect a broader scope set without sending write probes. The app transport defaults to `operator.read,operator.write,operator.pairing` so it can self-revoke paired device tokens when a signed device identity is available. `operator.admin` is not required for the M1 command surface and should not be a default.

Plugin-registered gateway RPC methods may request their own operator scope, but reserved core admin prefixes (`config.*`, `exec.approvals.*`, `wizard.*`, `update.*`) always resolve to `operator.admin`. Some slash commands reached through `chat.send` apply stricter command-level checks on top (e.g. persistent `/config set` writes require `operator.admin`).

### Pairing paths (no OpenClaw patching required)

OpenClaw pairing does not require any OpenClaw-side modification for ClawFace. The Gateway accepts any client that presents a valid token + signed challenge nonce during `connect`. Three token-acquisition paths are available:

1. **Shared Gateway token** — the simplest local-M1 path. The user copies the Gateway token into a ClawFace pairing payload. The token is passed in `connect.params.auth.token`.
2. **OpenClaw bootstrap token** — OpenClaw's `device-pair` plugin (Telegram `/pair`, `openclaw qr` CLI) already generates base64-encoded setup codes containing `{ url, bootstrapToken }`. ClawFace can accept the same format. The bootstrap token carries bounded operator scopes (`operator.approvals`, `operator.read`, `operator.talk.secrets`, `operator.write`) and works for initial connect; the Gateway issues a device token in `hello-ok.auth.deviceToken` for subsequent reconnects.
3. **Direct device pairing** — ClawFace connects with a persisted per-agent device identity and the Gateway creates a pending device pairing request that the user approves via `openclaw devices approve <requestId>` or via a channel-based approval flow.

The **only** ClawFace-specific part of pairing is how the user gets the token/URL onto the phone — the QR code scanning flow, paste input, or Bonjour auto-discovery. The Gateway protocol handshake is identical regardless.

The first app pairing bridge accepts a ClawFace QR/paste payload with `transport: "openclaw-gateway"`, `host`, `port`, optional `secure`, optional display `context`, and optional `token` or `sessionKey` containing the Gateway-issued/approved operator credential. If a credential is present, the app stores it as an OpenClaw Gateway device token in SecureStore before connecting. If no credential is present, the app attempts the signed `connect.challenge` flow so OpenClaw can create a direct device-pairing approval request for the mobile device identity. This is an interim local-M1 path that coexists with the OpenClaw bootstrap token format; it must not become a separate ClawFace auth protocol.


### Gateway methods ClawFace expects to use

Known candidates from local OpenClaw docs and generated Gateway schema declarations (`dist/plugin-sdk/src/gateway/protocol/schema/*.d.ts`):

| ClawFace need | Candidate Gateway method(s) | Request shape |
| --- | --- | --- |
| Discover Gateway health/status | `health`, `status` | Read-only; payloads remain OpenClaw-owned. |
| Discover connected devices/presence | `system-presence` | Read-only; payload remains OpenClaw-owned. |
| Discover sessions | `sessions.list`, `sessions.preview`, `sessions.get` | `sessions.list` supports bounded query params such as `limit`, `activeMinutes`, `includeDerivedTitles`, `includeLastMessage`, `label`, `agentId`, and `search`. |
| Subscribe to session index and messages | `sessions.subscribe`, `sessions.messages.subscribe` | `sessions.messages.subscribe` takes `{ key }` where `key` is the full opaque session key. |
| Send a user turn into an existing session | Prefer `sessions.send` for ClawFace Thread sends | `sessions.send` takes `{ key, message, thinking?, attachments?, timeoutMs?, idempotencyKey? }`. It is the best fit for a mobile Thread bound to a known opaque OpenClaw session key. |
| Lower-level chat send/history | `chat.history`, `chat.send`, `chat.abort` | `chat.history` takes `{ sessionKey, limit?, maxChars? }`. `chat.send` takes `{ sessionKey, message, thinking?, deliver?, attachments?, timeoutMs?, idempotencyKey }` and additional provenance/origin fields that require admin scope; ClawFace should avoid those fields. |
| Steer/abort active work | `sessions.steer`, `sessions.abort`, `chat.abort` | Post-M1 unless the single-thread loop needs abort. Use opaque session key and Gateway-provided run id. |
| Resolve approvals | `exec.approval.resolve`, `plugin.approval.resolve` | Requires `operator.approvals`; payloads are OpenClaw-owned and Post-M1 unless surfaced during M1 testing. |
| Revoke stored device token | `device.token.revoke` | Requires `operator.pairing`; ClawFace calls it with `{ deviceId, role: "operator" }` when a connected signed device identity is available, then clears the local SecureStore token. Interim token-only pairing falls back to local deletion with a warning. |

The app transport binds to `sessions.*` first. On `hello-ok`, `OpenClawGatewayTransport` derives initial Agent Context from `hello-ok.snapshot.presence` and `hello-ok.snapshot.sessionDefaults` and emits it to the store. On connect, it calls `sessions.list` with a bounded limit and derived-title/last-message hints, then emits ClawFace `thread_updated` events for returned sessions. Each returned full opaque Gateway `key` becomes the ClawFace `Thread.id` and `context.agentSessionId`; ClawFace does not parse the key. Before sending a user turn, it best-effort subscribes to `sessions.messages.subscribe` for the full opaque Thread/session key, then calls `sessions.send` with an idempotency key. Subscription failure is surfaced as a transport notice and does not prevent the send. `chat.*` remains useful for history and lower-level compatibility, but it exposes provenance/origin fields that are not part of the default mobile command surface.

### Gateway events ClawFace expects to consume

Known event families from OpenClaw docs and schema declarations:

| ClawFace model | Gateway event family | Handling |
| --- | --- | --- |
| Session transcript updates | `session.message` | Primary event family for a subscribed Thread/session. Current Gateway payloads carry `{ sessionKey, message, messageId?, messageSeq?, ...sessionSnapshot }`. ClawFace maps `user`, `assistant`, and `tool` transcript messages onto its existing `Message` model and derives numeric IDs by hashing the full opaque `sessionKey` plus `messageId`/`messageSeq`/message payload. |
| Agent stream/progress | `agent` | `AgentEvent` has `{ runId, seq, stream, ts, sessionKey?, data }`. When `sessionKey` is present, ClawFace normalizes `stream: "assistant"` into assistant message upserts and `stream: "tool"` / `stream: "command_output"` into tool-chip updates keyed by the full opaque `sessionKey`. Unknown streams remain controlled notices. |
| Tool stream chips | `session.tool` | Maps subscribed tool events with `{ sessionKey, data: { phase, toolCallId, name?, args?, partialResult?, result?, isError? } }` into ClawFace tool messages. `start`/`update` render as `running`; `result` renders as `done` or `failed`. |
| Chat stream compatibility | `chat` | `ChatEvent` has `{ runId, sessionKey, seq, state, message?, errorMessage?, errorKind?, usage?, stopReason? }`. OpenClaw `state: "delta"` carries the current buffered assistant text, so ClawFace must upsert the partial message instead of appending it as an incremental suffix. `state: "final"` maps to final message upsert; `aborted`/`error` map to transport notices or final failed assistant state. |
| Session/workstream list updates | `sessions.changed` | Refresh or patch Workstream/Thread list without deriving route data from delimiters. |
| Presence/agent availability | `presence`, `tick`, `health` | Update connection/presence UI only; do not create noisy alerts. |
| Exec approval cards | `exec.approval.requested`, `exec.approval.resolved` | Requires `operator.approvals`; Post-M1 unless surfaced during M1 testing. |
| Plugin approval cards | `plugin.approval.requested`, `plugin.approval.resolved` | Requires `operator.approvals`; Post-M1 unless surfaced during M1 testing. |

OpenClaw owns full payload schemas. ClawFace's job is to normalize the subset it receives into app-domain events and surface unsupported/malformed frames as transport notices.

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

Potential small upstream improvements for mobile UX. These are upstream OpenClaw proposals, not ClawFace-specific protocol forks. The transport investigation (2026-04-29) confirmed that none of these are required for M1 pairing or messaging — they are quality-of-life enhancements.

1. **Register a `clawface-mobile` client ID** in the Gateway's built-in client enum, with an operator-appropriate mode (e.g. `operator` or a new `mobile` mode). This is a ~1-line enum extension. Benefit: correct presence visibility, mobile-specific policy hooks, clean audit trail. Without it, ClawFace uses `openclaw-probe` / `probe` and may be invisible in presence.
2. **Accept `clawface-mobile` in presence entry creation** so mobile operator clients show up in the macOS app's Instances tab and `system-presence` results (currently, `cli` mode is skipped; `probe` may be too).
3. **Document minimal operator scope bundles** for mobile read-only, mobile messaging, approvals, and pairing self-management.
4. **Explicit Agent Context summary shape** suitable for mobile display, if `hello-ok.snapshot`, presence, and session previews do not already expose enough metadata.
5. **Push-notification bridge** for approval/handoff events that carries only route metadata and no sensitive transcript content.

---

## 3. Normalization policy

Inbound Gateway frames must pass through the ClawFace transport normalization seam before app/store updates.

- Unknown Gateway events are ignored or surfaced as transport notices; they must not crash the app.
- Unsupported but known event families should produce explicit unsupported notices during development.
- Malformed known frames should become `malformed` transport events.
- Complete messages and thread/session snapshots should be idempotent upserts keyed by opaque IDs.
- Streaming deltas must only append to the message/session route they belong to. If OpenClaw provides sequence numbers, ClawFace should use them; otherwise duplicates are handled as delivered.
- Approval/handoff requests are keyed by the opaque Gateway approval request id supplied by OpenClaw.

### `hello-ok.policy` consumption

The Gateway returns transport policy limits in `hello-ok.payload.policy`:

- `maxPayload` (bytes): maximum frame size the Gateway will accept. ClawFace stores this per connection and rejects oversized outbound frames before sending.
- `maxBufferedBytes` (bytes): maximum buffered bytes before the Gateway closes the connection. ClawFace stores this per connection and rejects sends that would exceed the current socket buffer budget.
- `tickIntervalMs` (ms): Gateway tick/heartbeat interval. ClawFace stores this per connection and uses it to watch Gateway activity; if no Gateway frame arrives for more than two tick intervals while no request is pending, ClawFace closes the stale socket and surfaces a warning notice.

Oversized outbound frames and over-budget outbound buffers surface as ClawFace `transport_notice` events before sending. With Gateway diagnostics enabled, oversized inbound frames and slow outbound buffers may also emit `payload.large` events (sizes, limits, surfaces, safe reason codes — no message body or secrets) before the Gateway closes or drops the affected frame.

### Discovery: Bonjour/mDNS and wide-area DNS-SD

OpenClaw ships a bundled Bonjour plugin that advertises `_openclaw-gw._tcp` via mDNS on LAN. TXT records include non-secret hints:

- `role=gateway`
- `displayName=<name>`
- `gatewayPort=<port>` (Gateway WS + HTTP, default 18789)
- `gatewayTls=1` (only when TLS enabled)
- `gatewayTlsSha256=<fingerprint>` (only when TLS enabled)
- `transport=gateway`

ClawFace can browse `_openclaw-gw._tcp` on `local.` for LAN auto-discovery or on a configured wide-area DNS-SD domain (e.g. `openclaw.internal.`) for Tailscale setups. This eliminates manual URL entry for local pairing.

Security notes from OpenClaw docs:

- Bonjour/mDNS TXT records are unauthenticated. Clients must not treat TXT as authoritative routing.
- Route using the resolved service endpoint (SRV + A/AAAA). Treat `lanHost`, `gatewayPort`, `gatewayTlsSha256` as hints only.
- TLS pinning must never allow an advertised fingerprint to override a previously stored pin.

This is existing OpenClaw infrastructure that requires no upstream changes to consume.

### `system-event` presence beacons

OpenClaw operator clients can send periodic `system-event` beacons to enrich their presence entry. The macOS app uses this to report host name, IP, and `lastInputSeconds`. ClawFace could use `system-event` to keep its mobile presence visible to other OpenClaw clients and report device metadata (device name, platform, battery level).

### Broadcast event scoping

Gateway broadcast events are scope-gated:

- Chat, agent, and tool-result frames require at least `operator.read`.
- Plugin-defined `plugin.*` broadcasts are gated to `operator.write` or `operator.admin`.
- Status and transport events (`heartbeat`, `presence`, `tick`, connect/disconnect lifecycle) remain unrestricted.
- Unknown broadcast event families are scope-gated by default (fail-closed).

Each client connection keeps its own per-client sequence number for monotonic ordering.

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
