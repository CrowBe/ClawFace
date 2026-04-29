# ClawFace Architecture

Status: Draft
Created: 2026-04-27
Updated: 2026-04-29

This is the canonical product architecture document for ClawFace. If another document describes product surfaces, trust boundaries, relay responsibilities, approval safety, or hosted-vs-local responsibilities, it should defer to this file instead of repeating architecture decisions.

Related documents:

- `README.md` — project overview and development setup
- `CLAUDE.md` — coding-agent handoff notes and repo conventions
- `docs/PRODUCT_CONTEXT.md` — canonical product vision, audience, product promises, non-goals, and milestone framing
- `docs/UBIQUITOUS_LANGUAGE.md` — canonical product/domain terminology
- `docs/BACKLOG.md` — executable work backlog; not a source of architectural truth
- `docs/SCALING_AND_UNIT_ECONOMICS.md` — business model, cost drivers, quotas, and scaling considerations
- `docs/PROTOCOL.md` — canonical wire-protocol spec

Source-of-truth rule:

- product vision, audience, product promises, non-goals, and milestone framing live in `docs/PRODUCT_CONTEXT.md`
- product/domain terminology lives in `docs/UBIQUITOUS_LANGUAGE.md`
- product architecture, trust boundaries, relay responsibilities, approval safety requirements, and hosted/local responsibilities live here
- concrete WebSocket message schemas and ordering guarantees live in `docs/PROTOCOL.md`
- agent-side harness internals are out of scope for this repository, per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2 ("Not an agent runtime", "Not a model/tool configuration system"); production agent runtimes (OpenClaw, future plugins) own their own architecture in their own repositories
- business model, pricing assumptions, quotas, cost traps, and scaling economics live in `docs/SCALING_AND_UNIT_ECONOMICS.md`
- `docs/BACKLOG.md` should describe work to do and link to the canonical docs; it should not become a competing architecture spec
- `README.md` and `CLAUDE.md` may summarize and link, but should not redefine these decisions

---

## 1. Product Premise

ClawFace is an **AI agent operations app**: a mobile command surface for supervising, messaging, and safely directing work across trusted AI agents and workstreams. Coding agents are the current beachhead; the product itself is not coding-specific. The canonical product vision, audience, promises, non-goals, and milestone framing live in `docs/PRODUCT_CONTEXT.md` — this section only summarises the architectural implications.

The core promise (per `docs/PRODUCT_CONTEXT.md`):

- remote visibility into active **Trusted Agent** sessions
- safe mobile **Handoff** resolution (approve/deny/quick-reply on tool requests and pauses)
- quick replies that unblock long-running work
- notifications for events that need human attention
- a trusted mobile control surface for agents already running somewhere else

Architectural implications:

- ClawFace is the mobile **command surface**; it is not an agent runtime, not a model provider, and not a tool/MCP configuration system (`docs/PRODUCT_CONTEXT.md` non-goals 1 and 2).
- For OpenClaw integration, ClawFace is an **operator-class client** of the OpenClaw Gateway Protocol. It sits alongside the OpenClaw CLI, web UI, and native apps as a control-plane surface for an Agent Operator. It is not an OpenClaw node, runtime, channel handler, bridge, or capability host. OpenClaw's Gateway WebSocket Protocol is the single control-plane and node transport for all OpenClaw clients; the legacy TCP bridge has been removed from OpenClaw. ClawFace does not need to patch, fork, or extend OpenClaw to connect — it uses the existing Gateway exactly as the CLI, web UI, and macOS app do.
- The first commercial wedge is technical users supervising coding agents (OpenClaw-style today), but the architecture must not assume the user is a developer or that the agent on the other end is a coding agent.
- The stable contract between ClawFace and OpenClaw path B is the OpenClaw Gateway Protocol plus the ClawFace profile/overlay in `docs/PROTOCOL.md`. Legacy path A remains a ClawFace bridge/mock protocol fallback for local CLI-only development.
- OpenClaw pairing does not require any OpenClaw-side modification. The Gateway accepts any client presenting a valid token + signed challenge nonce. ClawFace-specific pairing UX (QR code flow, paste input, Bonjour auto-discovery) is purely a mobile client concern; the Gateway protocol handshake is identical for all operator clients.

---

## 2. Product Surfaces

ClawFace has three distinct surfaces.

### A. Open-source local companion

Purpose:

- build trust through inspectable local-first behaviour
- support direct pairing with local or self-hosted agent runtimes
- make the protocol and security posture clear
- act as a useful open-source agent-operations tool

Properties:

- pairs directly with local or self-hosted agents
- stores session secrets on-device
- supports LAN/WebSocket development flows
- does not require a hosted account for basic local use
- avoids sending prompts, code, logs, or secrets through third-party infrastructure by default

### B. Optional hosted relay/control plane

Purpose:

- remote access when phone and agent are not on the same network
- push notification delivery
- multi-device and multi-agent management
- durable presence and approval routing
- team/fleet features later

Properties:

- stores account/device/agent metadata
- stores routing, presence, entitlement, and notification state
- routes control messages between trusted paired endpoints
- does not execute agents
- does not run model inference
- does not become a plaintext transcript/log store by default
- does not proxy large artifacts unless deliberately designed and priced

Preferred deployment pattern:

- direct/local mode remains the default trust baseline
- hosted relay should prefer isolated relay nodes scoped to one user account or workspace over shared multi-tenant relay infrastructure
- a node-per-user/workspace relay keeps cross-user routing metadata and connection state out of a shared hot path
- shared relay infrastructure is not forbidden, but it needs an explicit privacy, cost, and operational justification before implementation

Note on "workspace" terminology in this section:

- `workspace` here refers to **infrastructure tenancy** — a per-account/per-workspace relay node or quota scope. It is not the same as the product-domain **Workstream** defined in `docs/UBIQUITOUS_LANGUAGE.md`, which is a unit of coordinated work owned by an Agent Operator. Avoid using "workspace" for product surfaces; reserve it for infra/tenancy.

### C. Native app surface

Purpose:

- mobile command/control UX
- pairing and revocation UX
- approvals
- notifications
- lightweight session messaging
- agent health/presence visibility

The native app is the main user-facing product surface, but account/billing/subscription truth should live on the web if paid hosted features are added.

---

## 3. Current Implementation Shape

Current repo shape:

- Expo app using Expo Router
- Zustand store for app state
- SecureStore for session keys and Gateway device tokens
- AsyncStorage-backed persistence for non-secret app state with forward migrations
- Legacy WebSocket transport for paired agent communication via bridge/mock server
- OpenClaw Gateway transport (`services/transport/openclaw-gateway.ts`) implementing Gateway Protocol v3 `connect` handshake, `sessions.send`, `sessions.messages.subscribe`, and `sessions.create` as an `operator` role client
- Gateway event normalization (`services/transport/normalize.ts`) for `session.message`, `chat`, and `session.tool` event families; unsupported `agent` streams surface as transport notices
- Read-only Gateway discovery script (`scripts/openclaw-gateway-discover.js`) for protocol validation and client identity/handshake testing
- Mock/dev WebSocket server and OpenClaw CLI bridge for local testing
- Three viable pairing token paths confirmed (shared token, OpenClaw bootstrap token from `device-pair` plugin, direct device pairing) — none require OpenClaw modification
- Expo Notifications integration
- Production Android cleartext traffic disabled, with explicit development opt-in

Important current boundary:

- ClawFace is currently a mobile client with two transport paths: legacy bridge/mock (path A) and OpenClaw Gateway (path B, in progress).
- The Gateway transport implementation covers connect, send, subscribe, thread creation, non-throwing approval-resolution notices, and connected-device token revocation via `device.token.revoke`. Remaining work includes mobile device signing, `hello-ok.policy` limit consumption, and end-to-end validation against a real local OpenClaw gateway (CF-026 remaining acceptance criteria; CF-016 path B).
- OpenClaw's Gateway is the sole production transport for all OpenClaw clients (the legacy TCP bridge has been removed from OpenClaw). ClawFace connects to the same WebSocket surface as the CLI, web UI, and macOS app without requiring any OpenClaw-side changes.
- The current client identity uses `openclaw-probe` / `probe` (a read-only probe identity). A first-class `clawface-mobile` client ID is a candidate upstream request for correct presence visibility — it is not required for M1 connectivity.
- OpenClaw provides Bonjour/mDNS discovery (`_openclaw-gw._tcp`) and wide-area DNS-SD for LAN and Tailscale-based auto-discovery. ClawFace does not yet consume this but can do so for improved local pairing UX.
- There is no production hosted relay/control plane yet.
- The persisted agent model has an explicit `mode: 'direct' | 'relay'` field, optional `relayUrl`, and `transport: 'legacy-websocket' | 'openclaw-gateway'`; direct mode with either transport is the implemented/local path.
- Relay transport is not implemented yet. Relay-mode agents currently fall back to the existing WebSocket transport with a warning until the hosted relay/control plane exists.
- Hosted architecture described here is the target shape for future work, not shipped behaviour.

---

## 4. Core Architecture

### Layer 1: Mobile client

Responsibilities:

- store paired agent metadata
- store session keys in SecureStore
- initiate pairing from QR/pasted payloads
- open and monitor threads
- send user messages
- present and resolve approval requests
- receive notifications
- reconnect to known agents

The client must treat session keys and approval decisions as privileged security material.

### Layer 2: Agent transport

Responsibilities:

- connect to paired agents over direct or relayed WebSocket transport
- authenticate with a scoped session key
- send user messages and approval decisions
- receive thread/message/approval events
- heartbeat and reconnect safely

Transport implementation must be resilient to disconnects, duplicate events, and stale approvals.

### Layer 3: Pairing and session management

Responsibilities:

- establish trust between phone and agent
- issue scoped session credentials
- bind sessions to an agent/device pair
- support revocation
- prevent replay of stale pairing payloads

Pairing must be explicit and user-visible. A pairing event should never silently grant broad control over unrelated agents or hosts.

### Layer 4: Approval workflow

Responsibilities:

- display approval requests clearly
- scope every approval to an agent, thread, request ID, and requested action
- expire stale approval requests
- submit exactly one approval/denial decision per request
- defend against replay or duplicate decision delivery

Approval actions are security-sensitive because they can authorize tool execution in a coding environment.

### Layer 5: Optional hosted relay/control plane

Responsibilities:

- authenticate accounts/devices/agents
- route encrypted or minimal control messages between paired endpoints
- maintain presence and connection state
- dispatch push notifications
- enforce plan/entitlement limits
- support revocation and audit metadata

The hosted control plane must not become hosted coding-agent compute. Agents continue to run on user-controlled machines or infrastructure.

### Layer 6: Push notifications

Responsibilities:

- alert users about approval requests and important agent/session events
- avoid sensitive payloads
- rate-limit noisy agents
- respect user notification preferences

Push payloads should contain only enough information to route the user back into the app.

---

## 5. Trust Boundary

The hosted control plane may reasonably know:

- account IDs
- device IDs
- agent IDs/names
- relay node/workspace identity
- connection presence
- notification routing metadata
- approval request IDs and statuses
- coarse timestamps
- plan/entitlement state

The hosted control plane should avoid storing by default:

- source code
- prompts
- full chat transcripts
- tool arguments containing paths, secrets, or content
- command outputs
- environment variables
- session keys

If transcript sync or history backup is ever added, it must be treated as a separate encrypted-content feature with explicit architecture, pricing, retention, and user-consent implications.

---

## 6. Architectural Guardrails

Non-negotiables:

1. ClawFace must never become accidental hosted compute for trusted AI agents.
2. Hosted infrastructure routes/control signals; it does not run agents.
3. Hosted infrastructure should not require plaintext access to prompts, code, command output, or secrets.
4. Mobile approvals/Handoffs must be authenticated, replay-resistant, and scoped to a specific paired agent/session/action.
5. Pairing must be explicit, revocable, and auditable.
6. Push notifications must carry minimal sensitive content.
7. Local-first/direct pairing remains valuable even if a hosted relay exists.
8. Expensive behaviours such as always-on relay, isolated relay nodes, long retention, audit logs, and large payload sync must be explicit plan features, not accidental defaults.
9. Agent runtimes — model providers, tool harnesses, MCP servers, browser tools — must not live in this repository. They are the responsibility of paired agent runtimes per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2.

---

## 7. Hosted Mode Requirements

Before a production hosted relay exists, ClawFace needs:

- account/device/agent identity model
- pairing protocol contract
- session key lifecycle
- revocation flow
- approval request expiry semantics
- replay protection for approval decisions
- rate limits and quota model
- push payload contract
- observability for relay connection state
- incident/debug tooling that does not expose sensitive content by default

Hosted mode should launch as a control-plane/relay product, not as transcript hosting or agent execution.

---

## 8. Near-term Architecture Priorities

1. ~~Define the pairing/session protocol contract.~~ Done — `docs/PROTOCOL.md` profile/overlay over OpenClaw Gateway Protocol v3.
2. ~~Document message schemas for transport events.~~ Done — transport types in `services/transport/types.ts`, Gateway normalizer in `services/transport/normalize.ts`.
3. ~~Add replay-safe approval semantics.~~ Done — `reqId` in CF-004.
4. Add revocation semantics for devices, agents, and sessions. (Device token revocation via Gateway RPC remains to be confirmed and wired.)
5. ~~Define local/direct mode vs hosted/relay mode boundaries.~~ Done — `mode: 'direct' | 'relay'` in CF-008.
6. Keep transcript/content sync out of scope until encryption, retention, and pricing are explicit.
7. Wire mobile device Ed25519 signing for non-loopback Gateway connections.
8. Consume `hello-ok.policy` limits (`maxPayload`, `tickIntervalMs`) in the Gateway transport.
9. Add Bonjour/mDNS browsing for LAN auto-discovery of OpenClaw Gateways.
10. Accept OpenClaw bootstrap token format alongside ClawFace's interim pairing payload.

The senior-looking work is the protocol, trust boundary, revocation model, replay-safe approvals, and cost-aware relay design — not rushing cloud features.
