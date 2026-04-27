# ClawFace Architecture

Status: Draft
Created: 2026-04-27

This is the canonical product architecture document for ClawFace. If another document describes product surfaces, trust boundaries, relay responsibilities, approval safety, or hosted-vs-local responsibilities, it should defer to this file instead of repeating architecture decisions.

Related documents:

- `README.md` — project overview and development setup
- `CLAUDE.md` — coding-agent handoff notes and repo conventions
- `docs/BACKLOG.md` — executable work backlog; not a source of architectural truth
- `docs/SCALING_AND_UNIT_ECONOMICS.md` — business model, cost drivers, quotas, and scaling considerations
- `docs/PROTOCOL.md` — canonical wire-protocol spec
- `docs/AGENT_ARCHITECTURE.md` — canonical agent-side component spec

Source-of-truth rule:

- product architecture, trust boundaries, relay responsibilities, approval safety requirements, and hosted/local responsibilities live here
- concrete WebSocket message schemas and ordering guarantees live in `docs/PROTOCOL.md`
- agent-side harness/component internals live in `docs/AGENT_ARCHITECTURE.md`
- business model, pricing assumptions, quotas, cost traps, and scaling economics live in `docs/SCALING_AND_UNIT_ECONOMICS.md`
- `docs/BACKLOG.md` should describe work to do and link to the canonical docs; it should not become a competing architecture spec
- `README.md` and `CLAUDE.md` may summarize and link, but should not redefine these decisions

---

## 1. Product Premise

ClawFace is an Expo mobile client for monitoring and controlling paired OpenClaw-style coding agents from a phone.

The core promise is:

- remote visibility into active coding-agent sessions
- safe mobile approval/denial of tool requests
- quick replies that unblock long-running work
- notifications for events that need human attention
- a trusted control surface for agents already running somewhere else

ClawFace is a **developer-operations companion app**, not a general consumer SaaS.

---

## 2. Product Surfaces

ClawFace has three distinct surfaces.

### A. Open-source local companion

Purpose:

- build trust through inspectable local-first behaviour
- support direct pairing with local or self-hosted agent runtimes
- make the protocol and security posture clear
- act as a useful open-source developer tool

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
- SecureStore for session keys
- AsyncStorage-backed persistence for non-secret app state
- WebSocket transport for paired agent communication
- mock/dev WebSocket server for local testing
- Expo Notifications integration
- production Android cleartext traffic disabled, with explicit development opt-in

Important current boundary:

- ClawFace is currently a mobile client plus local mock/dev server.
- There is no production hosted relay/control plane yet.
- There is no explicit `direct` vs `relay` transport mode in the persisted agent model yet; CF-008 tracks that work.
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

1. ClawFace must never become accidental hosted compute for coding agents.
2. Hosted infrastructure routes/control signals; it does not run agents.
3. Hosted infrastructure should not require plaintext access to prompts, code, command output, or secrets.
4. Mobile approvals must be authenticated, replay-resistant, and scoped to a specific paired agent/session/action.
5. Pairing must be explicit, revocable, and auditable.
6. Push notifications must carry minimal sensitive content.
7. Local-first/direct pairing remains valuable even if a hosted relay exists.
8. Expensive behaviours such as always-on relay, isolated relay nodes, long retention, audit logs, and large payload sync must be explicit plan features, not accidental defaults.

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

1. Define the pairing/session protocol contract.
2. Document message schemas for transport events.
3. Add replay-safe approval semantics.
4. Add revocation semantics for devices, agents, and sessions.
5. Define local/direct mode vs hosted/relay mode boundaries.
6. Keep transcript/content sync out of scope until encryption, retention, and pricing are explicit.

The senior-looking work is the protocol, trust boundary, revocation model, replay-safe approvals, and cost-aware relay design — not rushing cloud features.
