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

## Milestone 1 - Local single-thread OpenClaw connection

This milestone is the executable form of the "First real product milestone" in `docs/PRODUCT_CONTEXT.md`:

> A user can pair one trusted AI agent, keep workstreams distinct, and message or monitor work in the right context.

For the current coding-agent beachhead this is concretely:

- pair a local OpenClaw-backed agent through `scripts/openclaw-bridge.js`
- display Agent Context (repo path, branch, agent session/thread id) so the user sees where work belongs
- send a user message in one ClawFace Thread and receive the OpenClaw response back in the same Thread
- never silently route OpenClaw turns through a local fallback echo that looks like a real agent reply
- unpair/revoke cleanly

Per `docs/PRODUCT_CONTEXT.md`, **Approvals are explicitly out of scope for M1.** Approval bridging and Handoff lifecycle work are tracked but treated as Post-M1.

**M1 critical path:**

| Issue | Status |
|---|---|
| CF-001 Document the wire protocol | DONE |
| CF-002 Verify server fingerprint during pairing | DONE |
| CF-003 Decide and implement clientKey usage | DONE |
| CF-004 Add reqId for approval replay protection | DONE |
| CF-005 Session revocation on unpair and sign-out | DONE |
| CF-008 Explicit transport mode: direct vs relay | DONE |
| CF-009 Persistence schema migration | DONE |
| CF-014 OpenClaw local bridge MVP | DONE |
| CF-017 Workstream-first domain module | DONE |
| CF-018 Transport event normalization seam | DONE |
| CF-023 Bridge CLI adapter fallback is honest and configurable | DONE |
| CF-024 Document `OPENCLAW_SESSION_ID` and repo binding for first-run | DONE |
| CF-025 Gateway Protocol profile and discovery probe | DONE |
| CF-026 OpenClaw Gateway transport implementation (M1 path B) | IN_PROGRESS |
| CF-016 M1 readiness check: boot ClawFace and connect to OpenClaw in a single thread | TODO |

CF-016 has two valid local validation paths and may be satisfied by either:

- **Path A — Bridge.** ClawFace ↔ `scripts/openclaw-bridge.js` ↔ `openclaw agent` CLI subprocess. Lower friction to set up, lower fidelity to the production transport. Hardened by CF-023.
- **Path B — ClawFace as an operator client of the OpenClaw Gateway Protocol.** ClawFace pairs directly with a locally-running `openclaw gateway` (default `127.0.0.1:18789`) as an `operator` role client over OpenClaw's documented WebSocket Gateway Protocol — no bridge, no CLI subprocess, no monkey-patching. ClawFace is one more control-plane client of OpenClaw, on the same level as the OpenClaw CLI, web UI, and macOS app. Profiled by CF-025 and implemented by CF-026; this is the production-transport-shaped path. Verified to be feasible against `docs.openclaw.ai/gateway/protocol`.

Path B is the right long-term shape because OpenClaw's existing Gateway Protocol is a superset of what `docs/PROTOCOL.md` was inventing on its own: it already owns `connect` / `req` / `res` / `event` framing, signed-challenge pairing, authentication, scopes, session routing, and event delivery. Adopting it directly turns ClawFace into a normal upstream operator client of OpenClaw and lets `docs/PROTOCOL.md` shrink to a thin profile/overlay document instead of a parallel protocol spec. Path A (the bridge) remains a legacy fallback for users running `openclaw agent` CLI without a gateway.

**Transport investigation (2026-04-29):** Confirmed that OpenClaw has a single production transport (Gateway WebSocket Protocol v3; legacy TCP bridge removed). No OpenClaw patching is needed for ClawFace pairing or messaging — three token-acquisition paths are already available (shared Gateway token, bootstrap token from `device-pair` plugin, direct device pairing). Post-M1 opportunities to leverage existing OpenClaw infrastructure (Bonjour/mDNS discovery, bootstrap token format, `hello-ok.policy` limits, `system-event` beacons, upstream `clawface-mobile` client ID) are tracked in CF-027.

Everything else (CF-006, CF-007, CF-015, CF-019, CF-020, CF-021, CF-022, CF-027) is **Post-M1**: useful, but not on the path to "boot ClawFace and connect to OpenClaw in a single thread."

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
**Priority:** P1
**Milestone:** Post-M1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-014, CF-004, CF-018, CF-020

> Per `docs/PRODUCT_CONTEXT.md` "First real product milestone", approvals are explicitly **not** part of M1. M1 only requires the user to pair, see Agent Context, and exchange messages in one Thread. CF-015 unlocks ClawFace as a serious mobile control surface for consequential agent actions, but it does not gate "boot up + connect in a single thread."

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

### CF-016 - M1 readiness check: boot ClawFace and connect to OpenClaw in a single thread

**Status:** TODO
**Priority:** P0
**Milestone:** M1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-014, CF-018, CF-023, CF-024

> This is the executable form of the M1 milestone in `docs/PRODUCT_CONTEXT.md`. It explicitly excludes approvals and async-event routing beyond the single-thread message round-trip. Approval bridging belongs to CF-015 (Post-M1), not here.
>
> Two valid local validation paths exist (see "Milestone 1" preamble at top of this file): **path A** uses `scripts/openclaw-bridge.js` (legacy CLI shell-out fallback); **path B** has ClawFace pair with a local `openclaw gateway` as an `operator` role client over OpenClaw's documented Gateway WebSocket Protocol (CF-026). CF-016 may be satisfied by either, or by both. Path B is the production-transport-shaped path and is the long-term home of M1 validation; path A remains as a fallback for users running `openclaw agent` CLI without a gateway.

#### Description

Validate the end-to-end M1 path against a real local OpenClaw on the maintainer's machine, and produce clean test instructions in `README.md` so the maintainer can repeat the validation. This issue is intentionally documentation-and-validation focused: do not declare M1 reachable until the documented path has been run from a clean start.

The scope is the smallest possible loop that satisfies `docs/PRODUCT_CONTEXT.md` "First real product milestone":

- pair ClawFace with the local OpenClaw target (path A: bridge → `openclaw agent` CLI; path B: `operator` client of `openclaw gateway` Gateway WS protocol via CF-026)
- see Agent Context (repo, branch, agent session/thread id) on the paired Trusted Agent and on the bound Thread
- send a user message in that Thread, receive the OpenClaw response back in the same Thread
- confirm the response was produced by the real OpenClaw runtime — for path A, the bridge logs say a real `openclaw` CLI turn ran (not the bridge fallback adapter, see CF-023); for path B, the response came from real OpenClaw session/event surfaces (not an echo)
- unpair and confirm the session is rejected

#### Acceptance criteria

- [ ] Run the full M1 manual test path against a real local OpenClaw via at least one of path A (bridge, hardened by CF-023) or path B (ClawFace as an operator client of the OpenClaw Gateway Protocol, CF-026). Not only the mock dev server, and not only the bridge fallback adapter.
- [x] `README.md` has a "M1 local test path" section covering at minimum path A with the exact commands for starting the bridge and Expo app, in order, with required env vars (`CLAWFACE_REPO_PATH`, `OPENCLAW_BIN`, `OPENCLAW_SESSION_ID`, `OPENCLAW_THREAD_ID`, `CLAWFACE_ALLOW_CLEARTEXT`) and their defaults
- [x] If path B was used, `README.md` documents the path B run instructions (point ClawFace at a running `openclaw gateway`, complete the operator pairing handshake, exercise the M1 round-trip)
- [x] `README.md` documents what the maintainer should see at each step: pairing succeeds, paired Trusted Agent shows Agent Context derived from OpenClaw (`hello-ok.snapshot` / `presence` for path B; bridge stdout for path A), the bound Thread shows repo/session metadata, sent message produces an OpenClaw response in the same Thread, transport logs confirm the response came from real OpenClaw (no fallback / no echo)
- [x] `README.md` documents how to tell a real OpenClaw turn apart from a bridge-fallback turn (per CF-023)
- [x] `README.md` documents known limitations and sharp edges honestly (e.g. approvals not bridged, only one bound thread per bridge instance, default bridge session id assumes `main`)
- [ ] Wire-protocol problems uncovered during the M1 validation are filed back as ClawFace issues / `docs/PROTOCOL.md` amendments before declaring M1 reachable
- [ ] Ping the maintainer with concise test instructions once the M1 path is validated

#### Test plan

Manual only: execute the documented instructions from a clean start (no prior pair state) and verify they work as written, against a real local `openclaw` install. Both happy-path and unpair/revoke must work.

#### Files

- `README.md`
- optional `docs/LOCAL_MVP_TESTING.md` only if README would become too long; otherwise keep the instructions in README to avoid another source of truth

---

### CF-023 - Bridge CLI adapter fallback is honest and configurable

**Status:** DONE
**Priority:** P0
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-014

> M1 cannot be declared reachable while the bridge can silently route a "successful" OpenClaw turn through a local fallback echo. The bridge must either talk to a real `openclaw` CLI or fail loudly. Real end-to-end validation against Ben's local OpenClaw install is tracked by CF-016, not by this adapter-hardening issue.

#### Description

`scripts/openclaw-bridge.js` currently hardcodes the `openclaw agent --session-id … --message … --json --timeout 120` invocation. That signature matches the documented `openclaw agent` CLI (https://docs.openclaw.ai/tools/agent-send), but it bakes in two assumptions that bite on first run:

1. The exact CLI flags work for the maintainer's installed OpenClaw build. If they don't (different version, custom build, or different binary path), the bridge falls back to a local echo.
2. The default OpenClaw CLI behaviour goes through the Gateway. For a local-first MVP test the bridge should force the embedded local runtime (`--local`).

When the CLI fails for any reason, the bridge currently still emits a `role: 'agent'` message with the fallback text, which renders in the ClawFace thread as if OpenClaw replied. The only signal the user has is a separate tool chip with a different `name`. That is too easy to miss.

This issue makes the bridge CLI configurable and makes adapter-fallback unmistakable in both the ClawFace UI and the bridge logs. It does not declare the full M1 path validated; CF-016 owns that end-to-end readiness check.

#### Acceptance criteria

- [x] Bridge reads CLI configuration from environment with documented defaults:
  - `OPENCLAW_BIN` (default `openclaw`)
  - `OPENCLAW_AGENT_ARGS` (default `--local --timeout 120`; appended after `--session-id` / `--message` / `--json`)
  - `OPENCLAW_TURN_TIMEOUT_MS` (default `130000`)
- [x] Bridge defaults to forcing the local OpenClaw runtime via `--local` so first-run does not silently rely on a Gateway
- [x] When the CLI fails, the bridge does **not** emit a `role: 'agent'` message with fallback text; it emits a `role: 'tool'` message with `status: 'failed'`, a clear `name` (`openclaw_cli_unavailable`), and a `result` containing the adapter detail
- [x] When the CLI succeeds, the bridge emits the existing tool chip + `role: 'agent'` reply unchanged
- [x] Bridge stdout/stderr clearly distinguishes a successful real-CLI turn from a fallback (e.g. `[openclaw] turn ok session=...` vs `[openclaw] FALLBACK cli unavailable: ...`)
- [x] `README.md` documents the new env vars and how to tell a real OpenClaw turn apart from a fallback in both the ClawFace UI and the bridge logs
- [x] `docs/PROTOCOL.md` does not need to change (the wire-level shape stays a normal `tool`/`message`/`agent` flow); add a short note only if the new tool name needs to be acknowledged in the protocol doc
- [x] No agent-runtime / model-provider / tool-harness / MCP code is reintroduced in this repository (per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2)
- [x] Real local OpenClaw end-to-end validation is explicitly deferred to CF-016, so this issue can close once the adapter is configurable and fallback is unmistakable

#### Test plan

```bash
npx tsc --noEmit
node -c scripts/openclaw-bridge.js
```

Manual:
1. Start the bridge with no `openclaw` binary on `PATH`. Pair from ClawFace, send a message. Confirm the Thread shows a failed tool chip and **no** `role: 'agent'` text masquerading as an OpenClaw reply. Bridge stdout shows a `FALLBACK` log line.
2. Override `OPENCLAW_BIN=/path/to/openclaw` and `OPENCLAW_AGENT_ARGS='--local --verbose on'`. Confirm the override is surfaced in the startup banner and used for CLI turns.
3. Real local OpenClaw success-path validation is performed by CF-016.

#### Files

- `scripts/openclaw-bridge.js`
- `README.md`

---

### CF-024 - Document OPENCLAW_SESSION_ID and repo binding for first-run

**Status:** DONE
**Priority:** P1
**Milestone:** M1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-014

#### Description

The bridge defaults `OPENCLAW_SESSION_ID` and `OPENCLAW_THREAD_ID` to `main`, which maps to the OpenClaw CLI `--session-id main` value. Path A must use a safe CLI session id (for example `main` or `clawface-m1`), not a Gateway session key such as `agent:main:main`; path B owns opaque Gateway session keys.

This issue keeps the default unchanged but makes the meaning, format, and override mechanism legible in `README.md`.

#### Acceptance criteria

- [x] `README.md` "OpenClaw local bridge" section documents that `OPENCLAW_SESSION_ID` / `OPENCLAW_THREAD_ID` are path-A CLI session ids such as `main`, while Gateway session keys such as `agent:main:main` belong to path B
- [x] `README.md` documents how to override `OPENCLAW_SESSION_ID` for a non-default path-A OpenClaw CLI session
- [x] No code change unless required to keep the README example honest

#### Test plan

Documentation only.

#### Files

- `README.md`

---

### CF-025 - Gateway Protocol profile and discovery probe

**Status:** DONE
**Priority:** P1
**Milestone:** M1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-001, CF-014

> Completed in PR #38. CF-025 is the safe discovery/profile slice for M1 path B: document ClawFace as an `operator` role client of OpenClaw Gateway Protocol, add a read-only discovery probe, and avoid app transport implementation until real Gateway method/event payload shapes are confirmed.

#### Description

CF-025 replaces the earlier "monkey-patch local OpenClaw" framing with an operator-client framing. OpenClaw already documents a Gateway WebSocket Protocol for control-plane clients (`operator`) and capability providers (`node`), so ClawFace should validate whether it can use that surface directly instead of inventing or upstreaming a separate ClawFace-only transport.

This slice updates the canonical docs and adds a read-only discovery helper. It does **not** implement `services/transport/openclaw-gateway.ts`, app pairing, token persistence, or message/event mapping.

#### Acceptance criteria

- [x] `docs/PROTOCOL.md` is rewritten as a ClawFace profile/overlay over OpenClaw Gateway Protocol v3.
- [x] Legacy bridge/mock protocol is preserved as Path A fallback.
- [x] `docs/ARCHITECTURE.md` records that ClawFace is an operator-class mobile command surface, not an OpenClaw node/runtime/channel handler/bridge.
- [x] `docs/UBIQUITOUS_LANGUAGE.md` maps OpenClaw operator/session/topic/deviceToken language to ClawFace product terms.
- [x] `scripts/openclaw-gateway-discover.js` performs read-only Gateway discovery without storing tokens or guessing payload schemas.
- [x] The probe uses OpenClaw-accepted client identity (`openclaw-probe` / `probe`) while declaring ClawFace in display name/user agent, because current OpenClaw validates client ids/modes against built-in enums.

#### Test plan

```bash
npx tsc --noEmit
node -c scripts/openclaw-gateway-discover.js
git diff --check
rg -n "split\(|:topic:|agentSessionId|agentThreadId|sessionKey" services app docs scripts
```

Manual discovery, when a Gateway auth token is available:

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=*** \
npm run gateway:discover
```

#### Follow-up

CF-026 owns the app transport implementation, pairing flow, Gateway event normalization, and CF-016 path B round-trip.

---

### CF-026 - OpenClaw Gateway transport implementation (M1 path B)

**Status:** IN_PROGRESS
**Priority:** P1
**Milestone:** M1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-025

> Implement the path B app transport after CF-025 discovery/profile has captured the safe boundary and confirmed that exact Gateway method/event payload shapes must be discovered rather than guessed.

#### Description

CF-026 implements an OpenClaw Gateway Protocol transport in ClawFace's `services/transport/` and pairs ClawFace as an `operator` role client against a local OpenClaw gateway. ClawFace becomes one more control-plane client of OpenClaw, on the same level as the OpenClaw CLI, web UI, and macOS app — but with mobile-first chat UI semantics and Agent Context overlays.

The OpenClaw side requires no monkey-patching. CF-026's deliverables are entirely on the ClawFace side: a Gateway Protocol transport, a pairing flow that produces a device token, mapping from OpenClaw's session keys / `agent` events / approval shapes onto ClawFace's domain model (Workstream / Thread / Agent Context / `Message`), and documentation updates for the concrete Gateway methods/events ClawFace uses.

**Current progress:** The core transport implementation is in place. `services/transport/openclaw-gateway.ts` implements `AgentTransport` with Gateway v3 `connect.challenge`/`connect` handling, `sessions.send` for user turns, `sessions.messages.subscribe` for thread event subscriptions, `sessions.create` for new threads, and device token persistence in SecureStore. `services/transport/normalize.ts` includes `GatewayTransportEventNormalizer` handling `session.message`, `chat`, `session.tool`, and session-keyed `agent` assistant/tool/command-output stream families, while unsupported `agent` streams surface as controlled notices. `app/pair.tsx` handles interim `transport: 'openclaw-gateway'` pairing payloads and stores the supplied Gateway credential/device token. `services/transport/index.ts` routes agents with `transport: 'openclaw-gateway'` through `OpenClawGatewayTransport`. Persistence migration V3→V4 backfills the `transport` field.

**Transport investigation findings (2026-04-29):** OpenClaw's Gateway WebSocket Protocol is the single production transport for all OpenClaw clients. The legacy TCP bridge has been removed. ClawFace does not need to patch or fork OpenClaw for pairing or messaging — three token-acquisition paths are already available (shared Gateway token, bootstrap token from `device-pair` plugin, direct device pairing). The current `openclaw-probe`/`probe` client identity works for M1 but a first-class `clawface-mobile` ID is a candidate upstream request for correct presence. OpenClaw also provides Bonjour/mDNS discovery and `hello-ok.policy` limits that ClawFace should consume.

#### Documentation boundary

CF-026 must update the canonical docs rather than turning this backlog item into the architectural source of truth:

- `docs/PROTOCOL.md` owns the ClawFace profile/overlay and should list only the concrete Gateway methods/events ClawFace actually uses.
- `docs/ARCHITECTURE.md` records the product/runtime boundary and any deliberate divergence between ClawFace product language and OpenClaw protocol language.
- Any OpenClaw-owned wire-format detail should be referenced, not duplicated.

#### Acceptance criteria

**Transport implementation**

- [x] A new ClawFace transport (`services/transport/openclaw-gateway.ts`) that implements the OpenClaw Gateway Protocol `connect` handshake at protocol version 3 with `role: "operator"` and scopes `operator.read`, `operator.write`, `operator.pairing`.
- [x] Pairing flow that collects an OpenClaw gateway address + auth (token or device pairing approval), goes through OpenClaw's `connect.challenge` signed handshake, and stores the resulting `deviceToken` in `services/secureStore.ts`. Interim token-based Gateway pairing, tokenless signed device-pairing attempts, and SecureStore persistence are implemented; mobile Ed25519 device identity/signature support is wired. Local OpenClaw validation on 2026-04-30 still rejects tokenless signed operator connects with `AUTH_TOKEN_MISSING` and `canRetryWithDeviceToken: false`, so tokenless direct-pair approval remains unvalidated until Gateway auth configuration supports that path.
- [x] Round-trip support for `sessions.send` (user turns) and `sessions.messages.subscribe` (streamed events). Maps onto ClawFace's existing `Message` discriminated union (user / agent / tool / approval), including full-text upsert semantics for OpenClaw chat deltas.
- [x] Session discovery/binding uses `sessions.list` on Gateway connect to surface recent OpenClaw sessions as ClawFace Threads keyed by the full opaque Gateway session key.
- [x] Session and thread identifiers are treated as opaque strings. ClawFace stores and routes with the full key; it does not split IDs on delimiters.
- [x] Idempotency keys are sent on `sessions.send`. ClawFace generates a unique key per send call.
- [x] `services/transport/normalize.ts` is extended with `GatewayTransportEventNormalizer` to validate OpenClaw Gateway Protocol frames (`session.message`, `chat`, `session.tool`, session-keyed `agent` assistant/tool/command-output streams; unsupported `agent` streams become controlled notices). Frame-shape mismatches surface as `malformed` events rather than crashing.
- [x] Gateway approval resolution (`resolveApproval`) currently surfaces a transport notice instead of throwing. Approval bridging itself is Post-M1 (CF-015).
- [x] Mobile device identity/signature path for Gateway `connect.challenge`; ClawFace persists a per-agent Ed25519 seed in SecureStore and signs the OpenClaw v3 challenge payload.
- [x] Gateway device token revocation via RPC is wired through `device.token.revoke` when a connected signed device identity is available; token-only interim pairing still falls back to local credential deletion with a warning.

**M1 single-thread round-trip (validates path B)**

- [ ] ClawFace pairs with a local OpenClaw gateway running on the maintainer's machine, with no use of `scripts/openclaw-bridge.js`.
- [x] Paired Trusted Agent shows Agent Context derived from OpenClaw's `hello-ok.snapshot` / `presence` data where available (host/display name and default agent session key).
- [ ] Sending a user message in one Thread produces an OpenClaw `agent` reply in the same Thread, streamed via `event:agent` and rendered as `message_delta` followed by a final upsert.
- [ ] Tool activity from OpenClaw renders as ClawFace tool chips (running → done / failed), driven by OpenClaw's streamed agent events. No fake/local-fallback tool chips.
- [ ] Approval requests from OpenClaw (if surfaced during M1 testing) render as ClawFace approval cards via the existing `approval_request` / `approval_decision` flow. Approval bridging deeper than the M1 single-thread loop remains scoped to CF-015 (Post-M1).
- [ ] Unpair revokes the device token via Gateway RPC and the gateway rejects further connects with the revoked token.
- [ ] CF-016 path B is satisfied when the above round-trip works against a real local OpenClaw gateway.

**Documentation and integration**

- [x] `README.md` documents path B local test instructions: how to pair ClawFace with a running `openclaw gateway` via the `openclaw-gateway` transport type.
- [x] An honest assessment, written into `docs/PROTOCOL.md`, of which extensions ClawFace would want upstream OpenClaw to add for mobile UX. Each candidate extension is described as a small upstream PR proposal, not a new protocol. (Completed in transport investigation 2026-04-29: five candidate upstream helpers documented in `docs/PROTOCOL.md` §2.7.)
- [x] The `scripts/openclaw-bridge.js` adapter remains for users running `openclaw agent` CLI without a Gateway, documented as a legacy fallback rather than the M1 path. CF-016 path A continues to use it; CF-016 path B uses the Gateway Protocol transport directly.

#### Test plan

Verification (paper):

1. Run `npm run gateway:discover` against a local Gateway with auth and record `hello-ok.features.methods/events` in `docs/PROTOCOL.md` before app integration. For opt-in path B round-trip probing, set `OPENCLAW_GATEWAY_SEND_TEXT` and write-capable scopes; the script sends a real `sessions.send` turn and captures summarized event shapes without logging message content. For opt-in revocation probing, set `OPENCLAW_GATEWAY_REVOKE_DEVICE_TOKEN=1` and pairing scope; the script calls `device.token.revoke` for the probe's signed device identity and verifies the revoked issued token is rejected on reconnect. Latest local authenticated probe (2026-04-30) succeeded with protocol 3, 137 advertised methods, 25 advertised events, `deviceTokenIssued: true`, policy `{ maxPayload: 26214400, maxBufferedBytes: 52428800, tickIntervalMs: 30000 }`, read-only `sessions.list` + keyed `sessions.preview`, a write-scope `sessions.create` + `sessions.messages.subscribe` + `sessions.send` round-trip that observed session-keyed `session.message`, `agent`, and `chat` events, and `device.token.revoke` for the signed probe device followed by rejected reconnect with the revoked issued token. Latest tokenless signed probe (2026-04-30) still failed with `AUTH_TOKEN_MISSING` / `canRetryWithDeviceToken: false`.
2. Confirm identifier compatibility without delimiter parsing: ClawFace either stores the full OpenClaw session/thread key as one opaque value or consumes separately-provided opaque fields from the gateway.
3. Confirm scope mapping: which OpenClaw operator scopes does each ClawFace UI surface need.

Manual (path B run):

1. Run `openclaw gateway` locally with a configured agent and at least one chat channel.
2. Pair ClawFace with the gateway as an `operator` role client.
3. Send a user message in one Thread; confirm the OpenClaw agent response streams back via Gateway events and renders correctly.
4. Confirm tool activity renders as live tool chips driven by OpenClaw events, not by local fallback.
5. Unpair; confirm the device token is revoked and reconnects fail.

#### Files

- `services/transport/openclaw-gateway.ts` — Gateway Protocol transport implementation
- `services/transport/normalize.ts` — extended to validate Gateway Protocol frames
- `services/transport/types.ts` — types aligned with OpenClaw's `req`/`res`/`event` shapes where applicable
- `services/secureStore.ts` — stores OpenClaw `deviceToken`
- `app/pair.tsx` — pairing flow updated for OpenClaw connect-challenge handshake
- `docs/PROTOCOL.md` — concrete method/event profile for ClawFace's Gateway use
- `README.md` — path B run instructions for CF-016
- `scripts/openclaw-bridge.js` — documented as legacy fallback (CF-016 path A); not removed

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
**Priority:** P2
**Milestone:** Post-M1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-014

> Refactor for locality of pairing orchestration. Not on the M1 critical path; current `app/pair.tsx` works against the bridge today. Schedule after M1 is declared reachable.

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
**Priority:** P1
**Milestone:** Post-M1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-006, CF-018

> Approvals/Handoffs are explicitly out of scope for M1 per `docs/PRODUCT_CONTEXT.md`. This module is the right home for approval lifecycle policy when CF-015 starts; it is not blocking "boot up + connect in a single thread".

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
**Priority:** P2
**Milestone:** Post-M1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-014, CF-018, CF-023

> Refactor inside `scripts/openclaw-bridge.js`. Schedule after CF-023 lands the configurable CLI seam, so the deepening pass extracts a real shape rather than the current hardcoded one.

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
**Priority:** P2
**Milestone:** Post-M1
**Epic:** G - Architecture Deepening
**Blocked by:** CF-017, CF-019

> Refactor for migration safety as Agent Context grows. Existing persistence + migration is good enough for M1; schedule after M1.

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

## Epic H — Transport Investigation Follow-ups

> These issues capture actionable opportunities identified by the transport investigation (2026-04-29). All are post-M1 quality-of-life improvements that leverage existing OpenClaw infrastructure without requiring upstream changes (except the client ID registration, which is a cosmetic enum addition).

---

### CF-027 — Transport investigation follow-ups: Bonjour discovery, bootstrap token, policy limits

**Status:** TODO
**Priority:** P2
**Milestone:** Post-M1
**Epic:** H — Transport Investigation Follow-ups
**Blocked by:** CF-026

#### Description

The transport investigation (2026-04-29) confirmed that OpenClaw's Gateway WebSocket Protocol is the single production transport and that ClawFace can use it without any OpenClaw-side modification. Several existing OpenClaw features are available but not yet consumed by ClawFace. This umbrella issue tracks the highest-value follow-ups.

#### Acceptance criteria

**Bonjour/mDNS LAN discovery**

- [ ] ClawFace browses `_openclaw-gw._tcp` on `local.` using a React Native mDNS library (e.g. `react-native-zeroconf`) to auto-discover local Gateways
- [ ] Discovered Gateways are presented in the pairing UI with display name, host, port, and TLS status from TXT records
- [ ] TXT records are treated as non-authoritative hints per OpenClaw security guidance: route using resolved SRV + A/AAAA, never allow an advertised TLS fingerprint to override a previously stored pin
- [ ] Wide-area DNS-SD browsing on a configured domain (e.g. `openclaw.internal.`) is supported for Tailscale setups

**OpenClaw bootstrap token format**

- [ ] ClawFace accepts the OpenClaw base64-encoded setup code format (`{ url, bootstrapToken }`) as a pairing input alongside the existing ClawFace QR/paste payload
- [ ] Bootstrap token is used for initial `connect.params.auth.token`; Gateway-issued `hello-ok.auth.deviceToken` is stored in SecureStore for subsequent reconnects
- [ ] Users who already have Telegram `/pair` or `openclaw qr` set up can pair ClawFace without generating a separate ClawFace-specific payload

**`hello-ok.policy` limit consumption**

- [x] Store `maxPayload` from `hello-ok.policy` and guard outbound frame size against it
- [x] Store `tickIntervalMs` and use it for Gateway tick/keepalive timeout detection instead of hardcoded constants
- [x] Oversized outbound frames are rejected client-side with a transport notice before sending

**`system-event` presence beacons**

- [ ] ClawFace sends periodic `system-event` beacons to enrich its presence entry (device name, platform, battery level)
- [ ] ClawFace appears in the macOS app's Instances tab and `system-presence` results when beacons are active

**Upstream client ID request (cosmetic, not blocking)**

- [ ] Open a small upstream PR or issue to register `clawface-mobile` as a valid `client.id` in the Gateway's built-in enum with an operator-appropriate mode
- [ ] Once accepted, update `services/transport/openclaw-gateway.ts` to use the new client ID

#### Test plan

```bash
npx tsc --noEmit
```

Manual:
1. With a local `openclaw gateway` running, confirm Bonjour discovery surfaces the Gateway in the ClawFace pairing UI.
2. Generate a bootstrap token via `openclaw qr` or Telegram `/pair` and confirm ClawFace accepts and connects.
3. Confirm `hello-ok.policy.maxPayload` is stored and a synthetically large outbound frame is rejected client-side.
4. Confirm `system-event` beacons make ClawFace visible in `openclaw nodes status` or the macOS app Instances tab.

#### Files

- `services/transport/openclaw-gateway.ts`
- `app/pair.tsx`
- `docs/PROTOCOL.md`
- New Bonjour discovery module as appropriate

---

## Epic I — Google Play Store Readiness

> These issues track the work required to ship ClawFace to the Google Play Store and establish the monetisation foundation. The app itself ships as a free download; paid features are unlocked by web-owned entitlements.

---

### CF-028 — Google Play Store deployment preparation

**Status:** TODO
**Priority:** P1
**Milestone:** Post-M1
**Epic:** I — Google Play Store Readiness
**Blocked by:** CF-016

#### Description

Prepare ClawFace for production deployment to the Google Play Store. The app ships as a free download. This issue covers the build, listing, and compliance work required to pass Play Console review.

#### Acceptance criteria

- [ ] `eas.json` configured with `development`, `preview`, and `production` build profiles (production outputs `.aab`)
- [ ] Google Play Developer Account created ($25 one-time)
- [ ] Google Service Account created and key stored for EAS Submit automation
- [ ] Production build succeeds via `eas build --platform android --profile production`
- [ ] Privacy Policy hosted at a public URL (draft at `docs/PRIVACY_POLICY.md`)
- [ ] Data Safety form completed in Play Console. ClawFace can truthfully declare: most data on-device only, session keys in platform-secure storage, no third-party data sharing, data deletion via unpair/sign-out
- [ ] Content rating questionnaire (IARC) completed
- [ ] Store listing: app icon (512×512), feature graphic (1024×500), at least 2 device screenshots, short description, full description
- [ ] Target API level ≥ 35 (Android 15) confirmed in production build
- [ ] 16KB page size support confirmed (Expo 54 / RN 0.81 should handle this)
- [ ] Internal testing track deployed and validated before public release

#### Test plan

Manual:
1. Build production AAB with `eas build --platform android --profile production`.
2. Upload to Play Console internal testing track.
3. Install from internal testing and verify pairing, messaging, and unpair flows work.
4. Verify Data Safety section renders correctly on the store listing preview.

#### Files

- `eas.json`
- `docs/PRIVACY_POLICY.md`
- `app.json` (verify `android.package`, `versionCode`, target SDK)

---

### CF-029 — E2E envelope encryption for relay-mode payloads

**Status:** TODO
**Priority:** P1
**Milestone:** Post-M1
**Epic:** I — Google Play Store Readiness
**Blocked by:** CF-026

> Architecture documented in `docs/ARCHITECTURE.md` §5 "End-to-end encryption for relay mode". This issue implements the encryption layer before the hosted relay launches as a paid feature.

#### Description

Add end-to-end envelope encryption so that when ClawFace routes messages through the hosted relay, the relay infrastructure handles only opaque encrypted blobs. The relay routes by metadata; it never reads message content, code, prompts, tool outputs, or secrets.

#### Acceptance criteria

- [ ] Add vetted pure-JS crypto dependencies for X25519 key agreement and XChaCha20-Poly1305 envelope encryption
- [ ] Generate a separate per-agent X25519 key agreement key and bind it to the existing Ed25519 device identity with a signed key-binding payload
- [ ] Implement X25519 ECDH key agreement during pairing to derive a shared symmetric key between phone and agent
- [ ] Store the derived shared key in SecureStore alongside the existing agent credentials
- [ ] Implement XChaCha20-Poly1305 per-message encryption: encrypt payload before relay send, decrypt after relay receive
- [ ] Relay frame format carries: routing metadata (agent ID, thread ID, direction, timestamp, message type) + encrypted payload blob + nonce
- [ ] Encryption is applied only in relay mode; direct/local mode continues to use TLS-only transport
- [ ] Existing direct-mode transport behaviour is unchanged
- [ ] `docs/PROTOCOL.md` updated with encrypted envelope frame format for relay mode
- [ ] `docs/ARCHITECTURE.md` §5 updated to reflect implementation status

#### Test plan

```bash
npx tsc --noEmit
```

Unit/integration:
1. Generate two Ed25519 identity keypairs plus separate X25519 key-agreement keypairs, verify signed key bindings, derive shared key, encrypt a message with one side, decrypt with the other.
2. Verify that encrypted payloads round-trip correctly through a mock relay that only touches routing metadata.
3. Verify that tampered ciphertext is rejected (Poly1305 authentication check).

#### Files

- `services/crypto/envelope.ts` (new — encryption/decryption module)
- `services/secureStore.ts` (store shared symmetric key)
- `services/transport/` (integrate encryption for relay-mode sends/receives)
- `docs/PROTOCOL.md`
- `docs/ARCHITECTURE.md`
- `package.json` (add `@noble/ciphers`)

---

### CF-030 — Web billing portal and entitlement API

**Status:** TODO
**Priority:** P2
**Milestone:** Post-M1
**Epic:** I — Google Play Store Readiness
**Blocked by:** CF-028

> Economics documented in `docs/SCALING_AND_UNIT_ECONOMICS.md` §3.1. This issue implements web-owned billing so the app ships as a free download with no in-app purchase flow, avoiding Google Play transaction fees.

#### Description

Build a web billing portal for Pro/Team subscriptions and an entitlement API the mobile app can query. The app checks entitlements at launch and on-demand; all subscription management happens on the web. This is the billing strategy recommended in `docs/SCALING_AND_UNIT_ECONOMICS.md` §3.1.

#### Acceptance criteria

- [ ] Web billing portal accepting Stripe subscriptions for Pro and Team tiers
- [ ] Entitlement API endpoint: given an account token, returns current plan tier, quota limits, and feature flags
- [ ] Mobile app queries entitlement API at launch and caches result locally
- [ ] Pro/Team features (relay access, multiple agents, push notifications) gated by entitlement state
- [ ] Free tier works fully without any entitlement check (local pairing, basic messaging)
- [ ] No in-app purchase flow or Play Billing Library integration in the mobile app
- [ ] `docs/SCALING_AND_UNIT_ECONOMICS.md` updated with implemented billing architecture

#### Test plan

1. Create a test Stripe subscription and verify entitlement API returns Pro tier.
2. Verify mobile app unlocks Pro features after querying the entitlement API.
3. Cancel subscription and verify entitlement API returns Free tier; app gates features accordingly.

#### Files

- Web billing portal (separate repo or hosted service)
- Entitlement API (separate repo or hosted service)
- Mobile app: entitlement query service, feature gating logic
- `docs/SCALING_AND_UNIT_ECONOMICS.md`

---

## Issue index

> Note: CF-030 (web billing portal) lives outside the ClawFace mobile repo per non-goals 1 and 2. It is tracked here for backlog completeness but implementation belongs to a separate service repository.

| Key | Title | Milestone | Priority | Status | Blocked by |
|---|---|---|---|---|---|
| CF-001 | Document the wire protocol | M1 | P0 | DONE | - |
| CF-002 | Verify server fingerprint during pairing | M1 | P1 | DONE | CF-001 |
| CF-003 | Decide and implement clientKey usage | M1 | P1 | DONE | CF-001 |
| CF-004 | Add reqId for approval replay protection | M1 | P0 | DONE | CF-001 |
| CF-005 | Session revocation on unpair and sign-out | M1 | P1 | DONE | CF-001 |
| CF-006 | Approval expiry (expiresAt) | Post-M1 | P1 | DONE | CF-004 |
| CF-007 | Push notification tap routing | Post-M1 | P1 | DONE | - |
| CF-008 | Explicit transport mode: direct vs relay | M1 | P2 | DONE | - |
| CF-009 | Persistence schema migration | M1 | P2 | DONE | CF-008 |
| CF-010 | Agent-side component architecture spec | - | P0 | REMOVED | CF-001 |
| CF-011 | Headless browser tool interface | - | P1 | REMOVED | CF-010 |
| CF-012 | Model provider interface | - | P1 | REMOVED | CF-010 |
| CF-013 | MCP server integration interface | - | P1 | REMOVED | CF-010 |
| CF-014 | OpenClaw local bridge MVP | M1 | P0 | DONE | CF-001 |
| CF-015 | OpenClaw approval bridge | Post-M1 | P1 | TODO | CF-014, CF-004, CF-018, CF-020 |
| CF-016 | M1 readiness check: boot ClawFace and connect to OpenClaw in a single thread | M1 | P0 | TODO | CF-014, CF-018, CF-023, CF-024 |
| CF-017 | Workstream-first domain module | M1 | P0 | DONE | CF-014 |
| CF-018 | Transport event normalization seam | M1 | P0 | DONE | CF-001, CF-014 |
| CF-019 | Pairing workflow adapter | Post-M1 | P2 | TODO | CF-014 |
| CF-020 | Handoff and approval lifecycle module | Post-M1 | P1 | TODO | CF-006, CF-018 |
| CF-021 | OpenClaw bridge adapter deepening | Post-M1 | P2 | TODO | CF-014, CF-018, CF-023 |
| CF-022 | Persistence and migration boundary | Post-M1 | P2 | TODO | CF-017, CF-019 |
| CF-023 | Bridge CLI adapter fallback is honest and configurable | M1 | P0 | DONE | CF-014 |
| CF-024 | Document `OPENCLAW_SESSION_ID` and repo binding for first-run | M1 | P1 | DONE | CF-014 |
| CF-025 | Gateway Protocol profile and discovery probe | M1 | P1 | DONE | CF-001, CF-014 |
| CF-026 | OpenClaw Gateway transport implementation (M1 path B) | M1 | P1 | IN_PROGRESS | CF-025 |
| CF-027 | Transport investigation follow-ups: Bonjour discovery, bootstrap token, policy limits | Post-M1 | P2 | TODO | CF-026 |
| CF-028 | Google Play Store deployment preparation | Post-M1 | P1 | TODO | CF-016 |
| CF-029 | E2E envelope encryption for relay-mode payloads | Post-M1 | P1 | TODO | CF-026 |
| CF-030 | Web billing portal and entitlement API | Post-M1 | P2 | TODO | CF-028 |
