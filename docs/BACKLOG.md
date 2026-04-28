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
| CF-025 ClawFace as an operator client of the OpenClaw Gateway Protocol (M1 path B) | TODO |
| CF-016 M1 readiness check: boot ClawFace and connect to OpenClaw in a single thread | TODO |

CF-016 has two valid local validation paths and may be satisfied by either:

- **Path A — Bridge.** ClawFace ↔ `scripts/openclaw-bridge.js` ↔ `openclaw agent` CLI subprocess. Lower friction to set up, lower fidelity to the production transport. Hardened by CF-023.
- **Path B — ClawFace as an operator client of the OpenClaw Gateway Protocol.** ClawFace pairs directly with a locally-running `openclaw gateway` (default `127.0.0.1:18789`) as an `operator` role client over OpenClaw's documented WebSocket Gateway Protocol — no bridge, no CLI subprocess, no monkey-patching. ClawFace is one more control-plane client of OpenClaw, on the same level as the OpenClaw CLI, web UI, and macOS app. Tracked by CF-025; this is the production-transport-shaped path. Verified to be feasible against `docs.openclaw.ai/gateway/protocol`.

Path B is the right long-term shape because OpenClaw's existing Gateway Protocol is a superset of what `docs/PROTOCOL.md` was inventing on its own (same `connect` / `req` / `res` / `event` framing, same signed-challenge pairing handshake, same session-key isolation with `:topic:` suffix). Adopting it directly turns ClawFace into a normal upstream operator client of OpenClaw and lets `docs/PROTOCOL.md` shrink to a thin profile/overlay document instead of a parallel protocol spec. Path A (the bridge) remains a legacy fallback for users running `openclaw agent` CLI without a gateway.

Everything else (CF-006, CF-007, CF-015, CF-019, CF-020, CF-021, CF-022) is **Post-M1**: useful, but not on the path to "boot ClawFace and connect to OpenClaw in a single thread."

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
> Two valid local validation paths exist (see "Milestone 1" preamble at top of this file): **path A** uses `scripts/openclaw-bridge.js` (legacy CLI shell-out fallback); **path B** has ClawFace pair with a local `openclaw gateway` as an `operator` role client over OpenClaw's documented Gateway WebSocket Protocol (CF-025). CF-016 may be satisfied by either, or by both. Path B is the production-transport-shaped path and is the long-term home of M1 validation; path A remains as a fallback for users running `openclaw agent` CLI without a gateway.

#### Description

Validate the end-to-end M1 path against a real local OpenClaw on the maintainer's machine, and produce clean test instructions in `README.md` so the maintainer can repeat the validation. This issue is intentionally documentation-and-validation focused: do not declare M1 reachable until the documented path has been run from a clean start.

The scope is the smallest possible loop that satisfies `docs/PRODUCT_CONTEXT.md` "First real product milestone":

- pair ClawFace with the local OpenClaw target (path A: bridge → `openclaw agent` CLI; path B: `operator` client of `openclaw gateway` Gateway WS protocol via CF-025)
- see Agent Context (repo, branch, agent session/thread id) on the paired Trusted Agent and on the bound Thread
- send a user message in that Thread, receive the OpenClaw response back in the same Thread
- confirm the response was produced by the real OpenClaw runtime — for path A, the bridge logs say a real `openclaw` CLI turn ran (not the bridge fallback adapter, see CF-023); for path B, the response came from real OpenClaw session/event surfaces (not an echo)
- unpair and confirm the session is rejected

#### Acceptance criteria

- [ ] Run the full M1 manual test path against a real local OpenClaw via at least one of path A (bridge, hardened by CF-023) or path B (monkey-patched local OpenClaw native server, CF-025). Not only the mock dev server, and not only the bridge fallback adapter.
- [ ] `README.md` has a "M1 local test path" section covering at minimum path A with the exact commands for starting the bridge and Expo app, in order, with required env vars (`CLAWFACE_REPO_PATH`, `OPENCLAW_BIN`, `OPENCLAW_SESSION_ID`, `OPENCLAW_THREAD_ID`, `CLAWFACE_ALLOW_CLEARTEXT`) and their defaults
- [ ] If path B was used, `README.md` documents the path B run instructions (point ClawFace at a running `openclaw gateway`, complete the operator pairing handshake, exercise the M1 round-trip)
- [ ] `README.md` documents what the maintainer should see at each step: pairing succeeds, paired Trusted Agent shows Agent Context derived from OpenClaw (`hello-ok.snapshot` / `presence` for path B; bridge stdout for path A), the bound Thread shows repo/session metadata, sent message produces an OpenClaw response in the same Thread, transport logs confirm the response came from real OpenClaw (no fallback / no echo)
- [ ] `README.md` documents how to tell a real OpenClaw turn apart from a bridge-fallback turn (per CF-023)
- [ ] `README.md` documents known limitations and sharp edges honestly (e.g. approvals not bridged, only one bound thread per bridge instance, default session id assumes `agent:main:main`)
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
**Milestone:** M1
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

The bridge defaults `OPENCLAW_SESSION_ID` and `OPENCLAW_THREAD_ID` to `agent:main:main` with no explanation of what those values mean or how to discover the right value for a real OpenClaw install. The `agent:main:main` pattern is the documented OpenClaw default session key (default agent `main`, default session `main`), but a first-time M1 tester reading the README has no way to know that, and no way to know what to change if their OpenClaw config uses a non-default agent name.

This issue keeps the default unchanged but makes the meaning, format, and override mechanism legible in `README.md`.

#### Acceptance criteria

- [x] `README.md` "OpenClaw local bridge" section documents the `OPENCLAW_SESSION_ID` / `OPENCLAW_THREAD_ID` format (`agent:<agentName>:<sessionLabel>`) and links to https://docs.openclaw.ai for canonical OpenClaw session-key behaviour
- [x] `README.md` documents how to override `OPENCLAW_SESSION_ID` for a non-default OpenClaw agent configuration
- [x] No code change unless required to keep the README example honest

#### Test plan

Documentation only.

#### Files

- `README.md`

---

### CF-025 - ClawFace as an operator client of the OpenClaw Gateway Protocol (M1 path B)

**Status:** TODO
**Priority:** P1
**Milestone:** M1
**Epic:** F - OpenClaw Local MVP
**Blocked by:** CF-001, CF-014

> M1 validation path B. Connect ClawFace to a local OpenClaw gateway as an `operator` role client over OpenClaw's existing Gateway WebSocket Protocol — no bridge, no CLI subprocess, no upstream OpenClaw change required. Validates the M1 single-thread loop against the same control-plane surface that OpenClaw's CLI / web UI / macOS app already use.

#### Background — what we found while drafting CF-025

CF-025 was originally drafted (in PR #35) as "monkey-patch local OpenClaw to expose endpoints conformant with `docs/PROTOCOL.md`, then upstream the patch as a new OpenClaw integration." A subsequent verification pass against the OpenClaw documentation (`docs.openclaw.ai/gateway/protocol.md`, `docs.openclaw.ai/concepts/architecture.md`, `docs.openclaw.ai/channels/telegram.md`, `docs.openclaw.ai/channels/pairing.md`) showed that framing is not the cleanest path. Three concrete findings drive the rewrite:

1. **OpenClaw already exposes a documented, stable WebSocket Gateway Protocol** at `127.0.0.1:18789` (configurable). The protocol distinguishes two roles: `operator` (CLI, web UI, macOS app, automations — control-plane clients that talk to and watch agents) and `node` (macOS/iOS/Android/headless devices that expose capabilities like `camera.*`, `canvas.*`, `screen.record`). ClawFace fits the `operator` role exactly: a mobile control-plane client that messages the agent and renders its replies + tool/approval state.
2. **`docs/PROTOCOL.md` is structurally a parallel-invention of the OpenClaw Gateway Protocol.** Both protocols use WebSocket + JSON, both use a `connect`/`hello` handshake with a signed challenge, both use `req`/`res`/`event` (or close cousins), both require idempotency keys / `reqId` for side-effecting methods, both pair via approval, both use device tokens, both isolate sessions by a key with a `:topic:` suffix for forum-style threading. There is no real protocol design difference that justifies a separate ClawFace-only wire format.
3. **The bridge's job is now even smaller than we thought.** The bridge translates ClawFace's wire protocol to OpenClaw's `agent` CLI subprocess. But OpenClaw's gateway already exposes a structured `agent` request method over its own WebSocket protocol. So the production transport already exists upstream — ClawFace just needs to speak it.

The "monkey-patch a new server into OpenClaw and upstream it" framing is therefore wrong. The right framing is: **ClawFace is a new operator-class client of the OpenClaw Gateway Protocol.** The upstream "PR" we may eventually need is small or zero — possibly some mobile-friendly UX touches (operator-pairing QR helpers, scope additions for mobile-specific approval flows). It is not a new protocol or a new channel.

#### Description

CF-025 implements an OpenClaw Gateway Protocol transport in ClawFace's `services/transport/` (alongside or replacing the existing `services/transport/websocket.ts`) and pairs ClawFace as an `operator` role client against a local OpenClaw gateway. ClawFace becomes one more control-plane client of OpenClaw, on the same level as the OpenClaw CLI, web UI, and macOS app — but with mobile-first chat UI semantics and Agent Context overlays.

The OpenClaw side requires no monkey-patching. CF-025's deliverables are entirely on the ClawFace side: a Gateway Protocol transport, a pairing flow that produces a device token, mapping from OpenClaw's session keys / `agent` events / approval shapes onto ClawFace's domain model (Workstream / Thread / Agent Context / `Message`), and clear documentation of what `docs/PROTOCOL.md` becomes.

#### What `docs/PROTOCOL.md` becomes

CF-025 closes the gap between two protocols by recasting `docs/PROTOCOL.md` as **ClawFace's profile of the OpenClaw Gateway Protocol** — a thin overlay document, not a parallel spec. The overlay covers only:

- which OpenClaw Gateway Protocol methods ClawFace uses (`connect`, `health`, `agent`, `send`, `system-presence`, etc.)
- which OpenClaw events ClawFace consumes (`agent` streaming, `presence`, `tick`, `shutdown`, etc.)
- the `operator` scope set ClawFace requires (likely `operator.read`, `operator.write`, `operator.approvals`, possibly `operator.pairing`)
- the mobile-specific UX overlays ClawFace adds on top: pairing QR format, Agent Context render hints, push-notification routing for approval requests
- the small set of legitimate ClawFace-only extensions (if any) — kept narrow and namespaced explicitly so they don't leak back into the protocol shape

Any wire-format spec that is genuinely OpenClaw's job to own (frame shapes, method definitions, event types) is **deleted** from `docs/PROTOCOL.md` and replaced with a reference to `docs.openclaw.ai/gateway/protocol`. ClawFace stops claiming ownership of the wire protocol; it owns its profile and overlays only.

#### Acceptance criteria

**Transport implementation**

- [ ] A new ClawFace transport (e.g. `services/transport/openclaw-gateway.ts`) that implements the OpenClaw Gateway Protocol `connect` handshake at protocol version 3 with `role: "operator"` and the minimum scopes ClawFace needs (`operator.read`, `operator.write`, plus `operator.approvals` if the M1 thread needs approval surfacing).
- [ ] Pairing flow that collects an OpenClaw gateway address + auth (token or device pairing approval), goes through OpenClaw's `connect.challenge` signed handshake, and stores the resulting `deviceToken` in `services/secureStore.ts`. No bespoke ClawFace pairing handshake.
- [ ] Round-trip support for `req:agent` and streaming `event:agent` payloads, mapped onto ClawFace's existing `Message` discriminated union (user / agent / tool / approval) with `message_delta` semantics covering OpenClaw's streamed agent updates.
- [ ] Session-key handling that respects OpenClaw's `agent:<agentName>:<session>` and `agent:<agentName>:<session>:topic:<threadId>` formats (per `docs.openclaw.ai/channels/telegram` "Forum topics append `:topic:`"). ClawFace's `agentSessionId` / `agentThreadId` fields map straight onto these.
- [ ] Idempotency keys are sent on every side-effecting method (`agent`, `send`) per OpenClaw's protocol requirement; ClawFace's existing `reqId` shape can be reused or aligned.
- [ ] `services/transport/normalize.ts` is extended to validate OpenClaw Gateway Protocol frames in the same way it currently validates `services/transport/websocket.ts` frames. Frame-shape mismatches surface as `malformed` events rather than crashing.

**M1 single-thread round-trip (validates path B)**

- [ ] ClawFace pairs with a local OpenClaw gateway running on the maintainer's machine, with no use of `scripts/openclaw-bridge.js`.
- [ ] Paired Trusted Agent shows Agent Context derived from OpenClaw's `hello-ok.snapshot` / `presence` data (repo, branch, agent session id, thread id).
- [ ] Sending a user message in one Thread produces an OpenClaw `agent` reply in the same Thread, streamed via `event:agent` and rendered as `message_delta` followed by a final upsert.
- [ ] Tool activity from OpenClaw renders as ClawFace tool chips (running → done / failed), driven by OpenClaw's streamed agent events. No fake/local-fallback tool chips.
- [ ] Approval requests from OpenClaw (if surfaced during M1 testing) render as ClawFace approval cards via the existing `approval_request` / `approval_decision` flow. Approval bridging deeper than the M1 single-thread loop remains scoped to CF-015 (Post-M1).
- [ ] Unpair revokes the device token (via `node.pair.revoke` / equivalent operator method) and the gateway rejects further connects with the revoked token.
- [ ] CF-016 path B is satisfied when the above round-trip works against a real local OpenClaw gateway.

**`docs/PROTOCOL.md` reshape**

- [ ] `docs/PROTOCOL.md` is rewritten as a profile/overlay document referencing `docs.openclaw.ai/gateway/protocol` for the wire format. Any text that duplicates OpenClaw's protocol spec is deleted.
- [ ] The overlay enumerates: methods ClawFace uses, events ClawFace consumes, scope set, mobile UX overlays, narrow ClawFace-only extensions (if any).
- [ ] `docs/UBIQUITOUS_LANGUAGE.md` is updated where ClawFace's vocabulary diverges from OpenClaw's (`session` / `topic` / `node` / `operator` / `device` / `pairing` / `approval`). Cheap alignments are taken; deliberate divergences are justified inline.
- [ ] `docs/ARCHITECTURE.md` is updated to reference OpenClaw's Gateway Protocol architecture (`docs.openclaw.ai/concepts/architecture.md`) where applicable, instead of describing ClawFace's transport in isolation.

**Upstream-OpenClaw work (if any)**

- [ ] An honest assessment, written into `docs/PROTOCOL.md` or a short companion doc, of which (if any) extensions ClawFace would want upstream OpenClaw to add for mobile UX (e.g. pairing QR helpers, push-notification scopes for approval requests, mobile-first Agent Context fields). Each candidate extension is described as a small upstream PR proposal, not a new protocol.
- [ ] The `scripts/openclaw-bridge.js` adapter remains for users running `openclaw agent` CLI without a gateway, but is documented as a legacy fallback rather than the M1 path. CF-016 path A continues to use it; CF-016 path B uses the Gateway Protocol transport directly.

#### Test plan

Verification (paper):

1. Walk `docs/PROTOCOL.md` against `docs.openclaw.ai/gateway/protocol`. For each pair / agent / approval / session surface, confirm OpenClaw already covers it. Mark any genuinely missing surface as a candidate upstream extension.
2. Confirm session-key compatibility with `agent:<agentName>:<session>:topic:<threadId>` against ClawFace's `agentSessionId` / `agentThreadId` shape.
3. Confirm scope mapping: which OpenClaw operator scopes does each ClawFace UI surface need.

Manual (path B run):

1. Run `openclaw gateway` locally with a configured agent and at least one chat channel.
2. Pair ClawFace with the gateway as an `operator` role client (via `auth.token` or device pairing approval, whichever the maintainer's gateway is configured for).
3. Send a user message in one Thread; confirm the OpenClaw agent response streams back via `event:agent` and renders correctly.
4. Confirm tool activity renders as live tool chips driven by OpenClaw events, not by local fallback.
5. Unpair; confirm the device token is revoked and reconnects fail.

#### Files

- `services/transport/openclaw-gateway.ts` (new) — Gateway Protocol transport implementation
- `services/transport/normalize.ts` — extended to validate Gateway Protocol frames
- `services/transport/types.ts` — types aligned with OpenClaw's `req`/`res`/`event` shapes where applicable
- `services/secureStore.ts` — stores OpenClaw `deviceToken`
- `app/pair.tsx` — pairing flow updated for OpenClaw connect-challenge handshake
- `docs/PROTOCOL.md` — rewritten as a profile/overlay of OpenClaw's Gateway Protocol
- `docs/UBIQUITOUS_LANGUAGE.md` — vocabulary alignment with OpenClaw
- `docs/ARCHITECTURE.md` — reference OpenClaw architecture where applicable
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

## Issue index

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
| CF-025 | ClawFace as an operator client of the OpenClaw Gateway Protocol (M1 path B) | M1 | P1 | TODO | CF-001, CF-014 |
