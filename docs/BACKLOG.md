# ClawFace Architecture Backlog

Each issue is self-contained: an agent can read it, implement the change, validate with the test plan, commit, and open a PR without further context. Issues link to their blocking dependencies. Complete blocking issues first.

This file is an executable backlog, not a source of architectural truth. When an issue creates or changes architecture, protocol, economics, or agent-component decisions, update the canonical document listed below rather than duplicating the decision here.

Related docs:
- `docs/PRODUCT_CONTEXT.md` - canonical product vision, audience, promises, and non-goals (source of truth for what ClawFace is and is not)
- `docs/UBIQUITOUS_LANGUAGE.md` - canonical product/domain vocabulary
- `docs/ARCHITECTURE.md` - canonical product architecture, trust boundary, relay, approval-safety, and hosted/local responsibility decisions
- `docs/SCALING_AND_UNIT_ECONOMICS.md` - canonical business model, quota, cost, abuse-control, and scaling considerations
- `docs/PROTOCOL.md` - canonical wire protocol
- `services/transport/types.ts` - TypeScript transport interface
- `scripts/dev-server.js` - local dev server reference for the wire protocol
- `scripts/openclaw-bridge.js` - thin local OpenClaw CLI adapter that satisfies the wire protocol for end-to-end testing

---

## Epic A - Protocol & Wire Contract

---

### CF-001 - Document the wire protocol

**Status:** DONE
**Priority:** P0
**Epic:** A - Protocol & Wire Contract
**Blocks:** CF-002, CF-003, CF-004, CF-005

#### Description

ClawFace's WebSocket protocol exists in code (`services/transport/websocket.ts`, `scripts/dev-server.js`) but has no written contract. An agent implementing a real agent-side server (e.g. OpenClaw plugin) has no spec to build against. This issue produces `docs/PROTOCOL.md` as the canonical wire spec.

The protocol has two endpoints:
- `/pair` - one-shot pairing handshake
- `/agent` - persistent bidirectional agent control channel

#### Acceptance criteria

- [x] `docs/PROTOCOL.md` created with:
  - [x] Pairing handshake sequence diagram (text/ASCII)
  - [x] All client->server message types with required fields and TypeScript types
  - [x] All server->client message types with required fields and TypeScript types
  - [x] Notes on ordering guarantees (e.g. `hello` must be first on `/agent`)
  - [x] Version field: current protocol version is `0.5.0` (matches `clientVersion` in `websocket.ts`)
  - [x] Notes on `fingerprint` intent (see CF-002) and `clientKey` intent (see CF-003)
- [x] `services/transport/types.ts` - add a typed union for all inbound server->client messages (currently only outbound event types are defined)
- [x] No new functionality introduced - doc and types only

#### Test plan

```bash
npx tsc --noEmit
```

Human review: every `ws.send(...)` in `scripts/dev-server.js` and every `case` in `websocket.ts:_handleMessage` has a matching entry in `docs/PROTOCOL.md`.

#### Files

- `docs/PROTOCOL.md` (new)
- `services/transport/types.ts`

---

### CF-002 - Verify server fingerprint during pairing

**Status:** DONE
**Priority:** P1
**Epic:** A - Protocol & Wire Contract
**Blocked by:** CF-001

#### Description

`app/pair.tsx` parses a `fingerprint` field from the QR/paste payload (`parsePairingPayload`, line ~38) but never uses it. Without checking it, pairing is vulnerable to a rogue server accepting the one-time code.

**Approach:** Server echoes fingerprint in the `session` response. Client compares `msg.fingerprint === payload.fingerprint`. Mismatch aborts with `'Fingerprint mismatch - possible rogue server'`. For dev, fingerprint is `'dev-fp'`.

#### Acceptance criteria

- [x] `app/pair.tsx` - in `ws.onmessage` session branch (~line 99), check fingerprint; reject on mismatch
- [x] `scripts/dev-server.js` - `handlePairSocket` includes `fingerprint: 'dev-fp'` in `session` response
- [x] Pairing with dev server succeeds end-to-end
- [x] `docs/PROTOCOL.md` updated: `session` response schema includes `fingerprint`

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. `npm run dev:server`, paste JSON into app -> pairing succeeds
2. Edit server to send `fingerprint: 'wrong'` -> app shows mismatch error

#### Files

- `app/pair.tsx`
- `scripts/dev-server.js`
- `docs/PROTOCOL.md`

---

### CF-003 - Decide and implement clientKey usage

**Status:** DONE
**Priority:** P1
**Epic:** A - Protocol & Wire Contract
**Blocked by:** CF-001

#### Description

`app/pair.tsx` generates a 32-byte random `clientKey` and sends it in the `pair` message (~line 81), but `scripts/dev-server.js` ignores it - only the one-time `code` is validated.

**Decision to implement:** Server derives `sessionKey = HMAC-SHA256('dev-secret', clientKey)`. This binds the session to the initiating client. A passive observer of the pairing exchange cannot use a leaked code to issue their own session.

#### Acceptance criteria

- [x] `scripts/dev-server.js` - compute `sessionKey = crypto.createHmac('sha256', 'dev-secret').update(msg.clientKey).digest('hex')`
- [x] `app/pair.tsx` - no logic change; add comment explaining `clientKey` purpose
- [x] `docs/PROTOCOL.md` - document HMAC derivation in the pairing section
- [x] End-to-end pairing with dev server still works

#### Test plan

```bash
npx tsc --noEmit
node scripts/dev-server.js
```

Manual: pair via paste -> session issued, transport connects, mock message exchange works.

#### Files

- `scripts/dev-server.js`
- `app/pair.tsx` (comment only)
- `docs/PROTOCOL.md`

---

## Epic B - Trust & Safety

---

### CF-004 - Add reqId for approval replay protection

**Status:** DONE
**Priority:** P0
**Epic:** B - Trust & Safety
**Blocked by:** CF-001

#### Description

Approval decisions are identified only by `msgId` (a `Date.now()` integer). There is no server-side deduplication - a replayed packet could approve an action twice.

Fix: server generates `reqId` (UUID v4) per approval request. Client includes `reqId` in `approval_decision`. Server tracks seen `reqId`s and silently drops duplicates.

#### Acceptance criteria

- [x] `data/seed.ts` - add `reqId?: string` to `Message`; seed approval messages get a placeholder `reqId`
- [x] `services/transport/types.ts` - `AgentTransport.resolveApproval` gains `reqId: string` parameter
- [x] `services/transport/websocket.ts` - `resolveApproval` includes `reqId` in payload; `_handleMessage` stores `reqId` from `approval_request`
- [x] `store/index.ts` - `resolveApproval` reads `reqId` from message and passes to transport
- [x] `scripts/dev-server.js` - generates `reqId: crypto.randomUUID()`; tracks seen Set; logs and ignores duplicates
- [x] `docs/PROTOCOL.md` updated with `reqId` in both `approval_request` and `approval_decision` schemas

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. Connect to dev server, tap Approve -> server logs `approved reqId=<uuid>`
2. Tap Approve again on same card -> server logs `duplicate ignored`

#### Files

- `data/seed.ts`
- `services/transport/types.ts`
- `services/transport/websocket.ts`
- `store/index.ts`
- `scripts/dev-server.js`
- `docs/PROTOCOL.md`

---

### CF-005 - Session revocation on unpair and sign-out

**Status:** DONE
**Priority:** P1
**Epic:** B - Trust & Safety
**Blocked by:** CF-001

#### Description

`store/index.ts` `removeAgent` (line ~185) and `signOut` (line ~213) disconnect the socket but never notify the server. The server retains the session key indefinitely.

Fix: send `{ type: 'revoke_session' }` before disconnect. Server invalidates the key; subsequent `hello` with that key returns an error.

#### Acceptance criteria

- [x] `services/transport/types.ts` - add `revoke(agentId: string): Promise<void>` to `AgentTransport`
- [x] `services/transport/mock.ts` - `revoke` stub emits `connection_changed` offline
- [x] `services/transport/websocket.ts` - `revoke(agentId)` sends `revoke_session` if connected then calls `disconnect`
- [x] `store/index.ts` - `removeAgent` calls `transport.revoke`; `signOut` calls `wsTransport.revoke` per agent
- [x] `scripts/dev-server.js` - handles `revoke_session`: logs, closes socket; rejects subsequent `hello` with same key
- [x] `docs/PROTOCOL.md` updated with `revoke_session`

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. Connect -> online
2. Unpair agent -> server logs `session revoked`
3. Re-pair with new code -> new session works

#### Files

- `services/transport/types.ts`
- `services/transport/websocket.ts`
- `services/transport/mock.ts`
- `store/index.ts`
- `scripts/dev-server.js`
- `docs/PROTOCOL.md`

---

## Epic C - Approval Workflow

---

### CF-006 - Approval expiry (expiresAt)

**Status:** DONE
**Priority:** P1
**Epic:** C - Approval Workflow
**Blocked by:** CF-004

#### Description

ARCHITECTURE.md section 4 requires "expire stale approval requests." Pending approvals currently accumulate forever.

Fix: add `expiresAt: number` (Unix ms) to approval messages. Filter from badge counts. Show "Expired" label in UI.

#### Acceptance criteria

- [x] `data/seed.ts` - add `expiresAt?: number` to `Message`; seed approvals get `expiresAt: Date.now() + 5 * 60 * 1000`
- [x] `store/index.ts` - `agentsWithPending()` and `pendingCount()` filter: `status === 'pending' && (expiresAt == null || Date.now() < expiresAt)`
- [x] `scripts/dev-server.js` - `approval_request` messages include `expiresAt: Date.now() + 300_000`
- [x] `app/alerts.tsx` - expired approvals render with "Expired" label and muted style; excluded from badge
- [x] `docs/PROTOCOL.md` updated: `expiresAt` is optional on `approval_request`

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. Edit server: `expiresAt: Date.now() + 5000`
2. Receive approval -> badge shows 1
3. Wait 6s -> badge shows 0, card shows "Expired"

#### Files

- `data/seed.ts`
- `store/index.ts`
- `app/alerts.tsx`
- `scripts/dev-server.js`
- `docs/PROTOCOL.md`

---

### CF-007 - Push notification tap routing

**Status:** DONE
**Priority:** P1
**Epic:** C - Approval Workflow

#### Description

`scheduleLocalApprovalNotification` (`services/notifications.ts:29`) is never called. Tapping a push notification does nothing - there is no `addNotificationResponseReceivedListener`.

#### Acceptance criteria

- [x] `app/_layout.tsx` - register `Notifications.addNotificationResponseReceivedListener`; on tap read `data.agentId`/`data.threadId`, navigate to `/chat/[agentId]/[threadId]`; clean up on unmount
- [x] `store/index.ts` - call `scheduleLocalApprovalNotification({ agentId, threadId, agentName, summary })` in the `approval_request` branch of `subscribeToTransport`; look up `agentName` from `store.getState().agents`
- [x] Import `scheduleLocalApprovalNotification` in `store/index.ts`

#### Test plan

```bash
npx tsc --noEmit
```

Manual (Android):
1. Connect to dev server, background app
2. Send message -> notification appears in tray
3. Tap -> app opens to correct thread with approval card

#### Files

- `app/_layout.tsx`
- `store/index.ts`

---

## Epic D - Architecture Boundaries

---

### CF-008 - Explicit transport mode: direct vs relay

**Status:** DONE
**Priority:** P2
**Epic:** D - Architecture Boundaries

#### Description

`resolveTransport` (`services/transport/index.ts`) selects transport based on `agent.sessionKey` presence only. There is no "direct" vs "relay" distinction in the type system. When a hosted relay exists, `agent.host` won't be directly reachable.

**Preferred relay deployment pattern:** `docs/ARCHITECTURE.md` defines node-per-user/workspace relay as the preferred hosted pattern. This issue reflects that decision in the mobile data model; do not redefine the relay architecture here.

This issue establishes the boundary in the type system. No relay transport is implemented here.

#### Acceptance criteria

- [x] `data/seed.ts` - `Agent` gains `mode: 'direct' | 'relay'` and `relayUrl?: string`; seed agents set `mode: 'direct'`
- [x] `store/index.ts` `addAgent` - sets `mode: 'direct'`
- [x] `services/transport/index.ts` `resolveTransport` - checks `agent.mode`; `'relay'` logs a console warning and falls back to `wsTransport`
- [x] `docs/ARCHITECTURE.md` section 2B still documents node-per-user/workspace relay as the preferred deployment pattern
- [x] `docs/ARCHITECTURE.md` section 3 updated to note the implemented `mode` field and that relay transport is not yet implemented

#### Test plan

```bash
npx tsc --noEmit
```

No behaviour change at runtime - verify by pairing via dev server and confirming messages still flow.

#### Files

- `data/seed.ts`
- `store/index.ts`
- `services/transport/index.ts`
- `docs/ARCHITECTURE.md`

---

### CF-009 - Persistence schema migration

**Status:** DONE
**Priority:** P2
**Epic:** D - Architecture Boundaries
**Blocked by:** CF-008

#### Description

`services/persistence.ts` uses `SCHEMA_VERSION = 1`. On version mismatch it returns `null` - the entire persisted state is discarded. As the `Agent` schema evolves (e.g. CF-008 adds `mode`), users lose their paired agents on upgrade.

Fix: apply forward migrations sequentially rather than discarding state.

#### Acceptance criteria

- [x] `services/persistence.ts` - `hydrateState` applies migrations from stored version to current `SCHEMA_VERSION`
- [x] Migration V1->V2: adds `mode: 'direct'` to any `Agent` missing the field
- [x] `SCHEMA_VERSION` bumped to `2`
- [x] `dehydrateState` writes new version
- [x] Migration throws -> fall back to `null`

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. Write V1 payload to AsyncStorage (dev console) with agents missing `mode`
2. Cold-start -> agents hydrate with `mode: 'direct'`, no crash, no data loss

#### Files

- `services/persistence.ts`

---

## Epic E - Agent-Side Component Architecture (REMOVED)

> This epic and the issues it scheduled (CF-010, CF-011, CF-012, CF-013) have been WITHDRAWN.
>
> They specified an in-tree agent runtime (HarnessAdapter, ModelProvider, McpServer, BrowserTool, ToolProvider) that contradicts `docs/PRODUCT_CONTEXT.md` non-goals 1 ("Not an agent runtime") and 2 ("Not a model/tool configuration system").
>
> The reference scaffolding under `agent/` and the standalone document `docs/AGENT_ARCHITECTURE.md` have been removed from this repository. The wire protocol in `docs/PROTOCOL.md` remains the only contract between ClawFace and any agent runtime; production agent runtimes (OpenClaw, future plugins) are responsible for their own internal architecture in their own repositories.
>
> The OpenClaw local bridge (`scripts/openclaw-bridge.js`) is intentionally retained as a thin WebSocket-to-CLI adapter so the wire protocol can be tested end-to-end against a real local OpenClaw install. It is not an agent runtime.

Issue index entries for CF-010..CF-013 are kept in the index for traceability and marked REMOVED there.

---

## Epic F - OpenClaw Local MVP

> These issues turn ClawFace from a mock-server mobile shell into a locally testable OpenClaw control surface. Keep the first bridge deliberately narrow: one local OpenClaw instance, one explicit repo/session binding, direct WebSocket mode, no hosted relay assumptions. The bridge is a thin WebSocket-to-CLI adapter and is the only OpenClaw-specific code allowed in this repository — it does not implement an agent runtime.

---

### CF-014 - OpenClaw local bridge MVP

**Status:** DONE
**Priority:** P0
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-001

#### Description

Implement the smallest real bridge that lets ClawFace pair with this local OpenClaw instance and exchange messages with a repo-bound OpenClaw session. This replaces the current mock-only local test path for the core conversation loop.

The MVP must make context explicit. Telegram-style global conversation state is not acceptable: every ClawFace thread must show and route through a concrete OpenClaw target such as repo path, branch, and session/thread id.

#### Acceptance criteria

- [x] Add an OpenClaw bridge entrypoint, separate from `scripts/dev-server.js`, that implements the ClawFace `/pair` and `/agent` WebSocket protocol in direct/local mode
- [x] Bridge prints a ClawFace-compatible pairing payload and/or QR source containing host, port, code, fingerprint, and protocol version
- [x] Pairing from the Expo app succeeds against the bridge without using the mock dev server
- [x] A paired agent stores enough metadata to display the active context: repo name/path, current branch if available, and OpenClaw session/thread id
- [x] Sending a message from ClawFace routes to the bound OpenClaw session
- [x] OpenClaw assistant responses stream or append back into the correct ClawFace thread
- [x] Async command completion events are routed to the correct ClawFace thread instead of a global Telegram/direct-chat context
- [x] The bridge rejects messages for unknown, revoked, or mismatched sessions
- [x] README documents the local bridge test flow separately from the mock dev server flow

#### Test plan

```bash
npx tsc --noEmit
```

Manual MVP test:
1. Start the OpenClaw local bridge from the repo.
2. Start the Expo app with local cleartext enabled if testing on Android/LAN.
3. Pair ClawFace using the bridge payload.
4. Confirm the paired agent/thread displays the repo/session context clearly.
5. Send a simple message from ClawFace and confirm the response returns to the same thread.
6. Trigger a safe async command/event and confirm it appears in the same ClawFace thread, not Telegram.
7. Unpair and confirm the bridge rejects the old session.

#### Files

- `scripts/openclaw-bridge.*` or equivalent bridge entrypoint
- `services/transport/types.ts` if protocol typing needs extension
- `docs/PROTOCOL.md` if wire messages change
- `README.md`

---

### CF-015 - OpenClaw approval bridge

**Status:** TODO
**Priority:** P0
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-014, CF-004, CF-018, CF-020

#### Description

Map OpenClaw tool/action approval requests into ClawFace approval cards and send approve/deny decisions back to OpenClaw safely. This is required before ClawFace can be trusted as a serious mobile control surface rather than a read-only chat viewer.

#### Acceptance criteria

- [ ] Bridge converts OpenClaw approval requests into ClawFace `approval_request` messages with stable `reqId`, human-readable title/body, risk level if available, and expiry
- [ ] ClawFace approve/deny actions call back into the correct OpenClaw pending approval
- [ ] Duplicate approval decisions are ignored by `reqId`
- [ ] Expired approval requests cannot be approved from ClawFace
- [ ] Approval results are reflected in the originating ClawFace thread
- [ ] README local MVP instructions include a safe approval test

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. Start the OpenClaw bridge and pair ClawFace.
2. Trigger a harmless approval-requiring action from the bound session.
3. Approve from ClawFace and confirm OpenClaw receives exactly one approval.
4. Attempt a duplicate approval and confirm it is ignored.
5. Trigger another approval, let it expire, and confirm ClawFace cannot approve it.

#### Files

- OpenClaw bridge approval integration files
- `services/transport/types.ts` if approval metadata needs extension
- `docs/PROTOCOL.md` if wire messages change
- `README.md`

---

### CF-016 - Local MVP test instructions and readiness check

**Status:** TODO
**Priority:** P1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-014, CF-015

#### Description

After the local bridge and approval bridge are implemented, evaluate the MVP end-to-end and produce clear instructions for Ben to test locally. This issue is intentionally documentation-and-validation focused: do not declare the MVP testable until the documented path has been run.

#### Acceptance criteria

- [ ] Run the full local MVP manual test path against a real OpenClaw bridge, not only the mock dev server
- [ ] Document exact commands for starting the bridge and Expo app
- [ ] Document what Ben should see at each step: pairing, context display, message response, async event routing, approval, unpair/revoke
- [ ] Document known limitations and sharp edges honestly
- [ ] Ping Ben with concise test instructions once the MVP path is validated

#### Test plan

Manual only: execute the documented instructions from a clean start and verify they work as written.

#### Files

- `README.md`
- optional `docs/LOCAL_MVP_TESTING.md` only if README would become too long; otherwise keep the instructions in README to avoid another source of truth

---

## Epic G - Architecture Deepening

> These issues apply the architecture-deepening pass informed by `docs/PRODUCT_CONTEXT.md` and `docs/UBIQUITOUS_LANGUAGE.md`. The goal is to make ClawFace more testable, AI-navigable, and aligned with its product domain without speculative broad rewrites. Each issue should deepen a module by improving leverage and locality behind a smaller interface.

---

### CF-017 - Workstream-first domain module

**Status:** DONE
**Priority:** P0
**Epic:** G - Architecture Deepening
**Blocked by:** CF-014

#### Description

ClawFace's product model centers on Workstreams, but the current app shape is still mostly Trusted Agent / Thread first. This issue introduces a small domain module around Workstream, Thread, Participant, and Agent Context concepts without forcing a full UI rewrite.

The goal is not to build blue-sky multi-agent collaboration yet. The goal is to create a seam where Workstream grouping, Thread routing, Agent Context display, and future multi-participant behavior can live with better locality.

#### Acceptance criteria

- [x] Add a domain module for Workstream-oriented selectors/types/helpers
- [x] Represent the current single-agent Thread model without pretending multi-agent Threads are implemented
- [x] Keep existing paired agent and thread UI behavior working
- [x] Move Workstream/Thread grouping logic out of screen components where practical
- [x] Use terms from `docs/UBIQUITOUS_LANGUAGE.md` consistently in new code and comments
- [x] Add or update tests for Workstream grouping and Thread lookup/routing if a test harness exists; otherwise document the manual validation path

#### Test plan

```bash
npx tsc --noEmit
git diff --check
```

Manual: pair or seed an agent, open its Threads, and confirm existing Thread navigation and Agent Context display still work.

#### Files

- `data/seed.ts`
- `store/index.ts`
- `app/index.tsx`
- `app/threads/[agentId].tsx`
- `app/chat/[agentId]/[threadId].tsx`
- new domain module path as appropriate

---

### CF-018 - Transport event normalization seam

**Status:** DONE
**Priority:** P0
**Epic:** G - Architecture Deepening
**Blocked by:** CF-001, CF-014

#### Description

Transport implementations currently parse and pass protocol messages into app state with limited normalization. As the OpenClaw bridge, future relay mode, streaming, duplicate delivery, and malformed payload handling grow, this creates poor locality for protocol correctness.

Create a normalization seam between raw wire messages and store events. The module should validate known message shapes, normalize them into app-level events, and centralize duplicate/stale/malformed handling policy where practical.

#### Acceptance criteria

- [x] Add a transport event normalization module or equivalent seam
- [x] Normalize WebSocket messages before they update store state
- [x] Handle unknown or malformed messages explicitly without crashing the app
- [x] Preserve existing mock and WebSocket transport behavior
- [x] Clarify duplicate or replay behavior for `message`, `message_delta`, approval/handoff messages, and unknown thread ids
- [x] Add targeted tests if a test harness exists; otherwise document smoke-test cases

#### Test plan

```bash
npx tsc --noEmit
git diff --check
```

Manual/smoke cases:
1. Normal `thread_created` event creates or updates the expected Thread.
2. `message_delta` and final `message` do not corrupt an existing Message.
3. Unknown/malformed server messages are ignored or surfaced as controlled errors.
4. Unknown thread ids do not silently attach work to the wrong Thread.

#### Files

- `services/transport/types.ts`
- `services/transport/websocket.ts`
- `services/transport/mock.ts`
- `store/index.ts`
- tests or smoke fixtures as appropriate

---

### CF-019 - Pairing workflow adapter

**Status:** TODO
**Priority:** P1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-014

#### Description

`app/pair.tsx` currently owns too much of the Pairing workflow: payload parsing, WebSocket handshake, fingerprint validation, SecureStore writes, push registration, Trusted Agent creation, and navigation. Pairing is security-sensitive and product-critical, so this logic needs better locality behind a focused adapter.

Create a Pairing workflow module that lets the UI remain mostly declarative while the workflow module owns Pairing orchestration and error modes.

#### Acceptance criteria

- [ ] Move Pairing orchestration out of `app/pair.tsx` into a focused module
- [ ] Keep UI responsible for rendering input/progress/errors and navigation decisions only where appropriate
- [ ] Preserve fingerprint validation and session key storage behavior
- [ ] Preserve Agent Context metadata from bridge Pairing/session responses
- [ ] Make error states explicit for invalid payload, invalid/expired code, fingerprint mismatch, storage failure, and connection failure
- [ ] Add targeted tests if a test harness exists; otherwise document manual validation cases

#### Test plan

```bash
npx tsc --noEmit
git diff --check
```

Manual:
1. Pair with a valid OpenClaw bridge payload.
2. Try an invalid payload.
3. Try a payload with mismatched fingerprint.
4. Confirm paired Trusted Agent stores expected Agent Context.

#### Files

- `app/pair.tsx`
- `services/secureStore.ts`
- `services/transport/websocket.ts`
- `store/index.ts`
- new Pairing workflow module path as appropriate

---

### CF-020 - Handoff and approval lifecycle module

**Status:** TODO
**Priority:** P0
**Epic:** G - Architecture Deepening
**Blocked by:** CF-006, CF-018

#### Description

Approvals should be treated as a kind of Handoff surfaced by an Agent runtime, not as generic app alerts. Current approval expiry, pending counts, notification eligibility, stale-decision behavior, and rendering concerns are split across store, UI, and notifications.

Create a lifecycle module for Handoffs and Approvals before implementing the OpenClaw approval bridge. This keeps CF-015 from baking lifecycle policy into the bridge or screens.

#### Acceptance criteria

- [ ] Introduce a Handoff/Approval lifecycle module with clear terms from `docs/UBIQUITOUS_LANGUAGE.md`
- [ ] Centralize pending/actionable/expired decision logic
- [ ] Ensure expired approvals cannot be resolved from ClawFace
- [ ] Ensure pending counts exclude expired or already-resolved Handoffs
- [ ] Keep existing approval cards and notification behavior working
- [ ] Add targeted tests if a test harness exists; otherwise document manual validation cases

#### Test plan

```bash
npx tsc --noEmit
git diff --check
```

Manual:
1. Seed or receive a pending approval and confirm it appears as actionable.
2. Let or force it expire and confirm it is no longer actionable.
3. Confirm notification/badge state matches actionable Handoffs only.

#### Files

- `store/index.ts`
- `app/alerts.tsx`
- `components/ApprovalCard.tsx`
- `services/notifications.ts`
- new Handoff lifecycle module path as appropriate

---

### CF-021 - OpenClaw bridge adapter deepening

**Status:** TODO
**Priority:** P1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-014, CF-018

#### Description

The OpenClaw bridge MVP is intentionally a standalone script. That was the right first slice, but the bridge should not become a dumping ground for protocol, session, and CLI integration logic.

Deepen the bridge inside `scripts/openclaw-bridge.js` so session, pairing-fingerprint, and CLI-adapter responsibilities have clearer boundaries inside the script, without introducing any in-tree agent runtime, model provider, tool harness, or MCP plumbing (per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2).

#### Acceptance criteria

- [ ] Identify the smallest bridge seam worth extracting after applying the deletion test
- [ ] Move session/protocol/CLI-adapter logic behind a deeper module *inside* `scripts/`, without changing the bridge CLI UX
- [ ] Preserve `/pair` and `/agent` behavior
- [ ] Preserve local bridge Pairing payload output
- [ ] Preserve rejection of unknown, revoked, or mismatched sessions
- [ ] Avoid introducing hosted relay assumptions
- [ ] Do not introduce any agent runtime, model provider, tool harness, browser tool, or MCP code in this repository

#### Test plan

```bash
npx tsc --noEmit
git diff --check
node -c scripts/openclaw-bridge.js
```

Manual/smoke: start the bridge, pair, create a Thread, send a message, revoke/unpair, and confirm old sessions are rejected.

#### Files

- `scripts/openclaw-bridge.js`
- `services/transport/types.ts` if protocol typing changes
- `docs/PROTOCOL.md` if wire messages change

---

### CF-022 - Persistence and migration boundary

**Status:** TODO
**Priority:** P1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-017, CF-019

#### Description

As Agent Context and future Workstream Context grow, persistence risk increases. Current persistence is useful but tied closely to full app state, while secrets live separately in SecureStore.

Create a clearer persistence module boundary around durable app state, privileged secrets, and transcript/content retention so future migrations remain safe and understandable.

#### Acceptance criteria

- [ ] Clarify which state is durable app state, which state is privileged secret material, and which state is transcript/content
- [ ] Centralize app-state migration logic behind a persistence module
- [ ] Preserve SecureStore-only handling for session keys and other privileged secrets
- [ ] Add migration coverage for current persisted schema and Agent Context fields
- [ ] Define corrupt-payload fallback behavior
- [ ] Avoid introducing hosted storage or sync assumptions

#### Test plan

```bash
npx tsc --noEmit
git diff --check
```

Manual: start from existing persisted local state where available and confirm agents, threads, Agent Context, and session secrets still load correctly.

#### Files

- `services/persistence.ts`
- `services/secureStore.ts`
- `store/index.ts`
- `data/seed.ts`
- tests or migration fixtures as appropriate

---

## Issue index

| Key | Title | Priority | Status | Blocked by |
|---|---|---|---|---|
| CF-001 | Document the wire protocol | P0 | DONE | - |
| CF-002 | Verify server fingerprint during pairing | P1 | DONE | CF-001 |
| CF-003 | Decide and implement clientKey usage | P1 | DONE | CF-001 |
| CF-004 | Add reqId for approval replay protection | P0 | DONE | CF-001 |
| CF-005 | Session revocation on unpair and sign-out | P1 | DONE | CF-001 |
| CF-006 | Approval expiry (expiresAt) | P1 | DONE | CF-004 |
| CF-007 | Push notification tap routing | P1 | DONE | - |
| CF-008 | Explicit transport mode: direct vs relay | P2 | DONE | - |
| CF-009 | Persistence schema migration | P2 | DONE | CF-008 |
| CF-010 | Agent-side component architecture spec | P0 | REMOVED | CF-001 |
| CF-011 | Headless browser tool interface | P1 | REMOVED | CF-010 |
| CF-012 | Model provider interface | P1 | REMOVED | CF-010 |
| CF-013 | MCP server integration interface | P1 | REMOVED | CF-010 |
| CF-014 | OpenClaw local bridge MVP | P0 | DONE | CF-001 |
| CF-015 | OpenClaw approval bridge | P0 | TODO | CF-014, CF-004, CF-018, CF-020 |
| CF-016 | Local MVP test instructions and readiness check | P1 | TODO | CF-014, CF-015 |
| CF-017 | Workstream-first domain module | P0 | DONE | CF-014 |
| CF-018 | Transport event normalization seam | P0 | DONE | CF-001, CF-014 |
| CF-019 | Pairing workflow adapter | P1 | TODO | CF-014 |
| CF-020 | Handoff and approval lifecycle module | P0 | TODO | CF-006, CF-018 |
| CF-021 | OpenClaw bridge adapter deepening | P1 | TODO | CF-014, CF-018 |
| CF-022 | Persistence and migration boundary | P1 | TODO | CF-017, CF-019 |
