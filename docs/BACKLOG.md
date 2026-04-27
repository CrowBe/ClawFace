# ClawFace Architecture Backlog

Each issue is self-contained: an agent can read it, implement the change, validate with the test plan, commit, and open a PR without further context. Issues link to their blocking dependencies. Complete blocking issues first.

This file is an executable backlog, not a source of architectural truth. When an issue creates or changes architecture, protocol, economics, or agent-component decisions, update the canonical document listed below rather than duplicating the decision here.

Related docs:
- `docs/ARCHITECTURE.md` - canonical product architecture, trust boundary, relay, approval-safety, and hosted/local responsibility decisions
- `docs/SCALING_AND_UNIT_ECONOMICS.md` - canonical business model, quota, cost, abuse-control, and scaling considerations
- `docs/PROTOCOL.md` - canonical wire protocol
- `docs/AGENT_ARCHITECTURE.md` - canonical agent-side component architecture
- `services/transport/types.ts` - TypeScript transport interface
- `scripts/dev-server.js` - local dev server (reference agent implementation)

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
  - [x] Version field: current protocol version is `0.4.0` (matches `clientVersion` in `websocket.ts:84`)
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

**Status:** TODO
**Priority:** P2
**Epic:** D - Architecture Boundaries

#### Description

`resolveTransport` (`services/transport/index.ts`) selects transport based on `agent.sessionKey` presence only. There is no "direct" vs "relay" distinction in the type system. When a hosted relay exists, `agent.host` won't be directly reachable.

**Preferred relay deployment pattern:** `docs/ARCHITECTURE.md` defines node-per-user/workspace relay as the preferred hosted pattern. This issue reflects that decision in the mobile data model; do not redefine the relay architecture here.

This issue establishes the boundary in the type system. No relay transport is implemented here.

#### Acceptance criteria

- [ ] `data/seed.ts` - `Agent` gains `mode: 'direct' | 'relay'` and `relayUrl?: string`; seed agents set `mode: 'direct'`
- [ ] `store/index.ts` `addAgent` - sets `mode: 'direct'`
- [ ] `services/transport/index.ts` `resolveTransport` - checks `agent.mode`; `'relay'` logs a console warning and falls back to `wsTransport`
- [ ] `docs/ARCHITECTURE.md` section 2B still documents node-per-user/workspace relay as the preferred deployment pattern
- [ ] `docs/ARCHITECTURE.md` section 3 updated to note the implemented `mode` field and that relay transport is not yet implemented

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

**Status:** TODO
**Priority:** P2
**Epic:** D - Architecture Boundaries
**Blocked by:** CF-008

#### Description

`services/persistence.ts` uses `SCHEMA_VERSION = 1`. On version mismatch it returns `null` - the entire persisted state is discarded. As the `Agent` schema evolves (e.g. CF-008 adds `mode`), users lose their paired agents on upgrade.

Fix: apply forward migrations sequentially rather than discarding state.

#### Acceptance criteria

- [ ] `services/persistence.ts` - `hydrateState` applies migrations from stored version to current `SCHEMA_VERSION`
- [ ] Migration V1->V2: adds `mode: 'direct'` to any `Agent` missing the field
- [ ] `SCHEMA_VERSION` bumped to `2`
- [ ] `dehydrateState` writes new version
- [ ] Migration throws -> fall back to `null`

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

## Epic E - Agent-Side Component Architecture

> These issues define the agent-side harness that ClawFace pairs with. They are not changes to the ClawFace mobile app. They likely live in a separate repo (e.g. `openclaw-agent` or similar). The stable boundary is the ClawFace wire protocol (CF-001) — everything in this epic is behind it and can change freely without touching the mobile client.

**Component map:**

```
ClawFace mobile
    |  WebSocket (CF-001 - stable boundary)
    v
[Harness] <-> [Model provider interface]
    |               (Anthropic / OpenAI / Ollama / user-supplied)
    |
    +-> [MCP server interface] <-> [Tool implementations]
    |                                  +- [Browser tool interface]
    |                                  |     (Lightpanda / Playwright / mock)
    |                                  +- [File system tool]
    |                                  +- [Shell tool]
    +-> [Session / pairing / approval routing]
```

Design principle: each component boundary is an interface. Swapping the harness (e.g. pi.dev -> custom), the browser (Lightpanda -> Playwright), or the model provider must not require changes to ClawFace or to sibling components. The MCP protocol is the natural tool-layer boundary.

---

### CF-010 - Agent-side component architecture spec

**Status:** TODO
**Priority:** P0
**Epic:** E - Agent-Side Component Architecture
**Blocked by:** CF-001

#### Description

Before building any agent-side components, define the interfaces that make them substitutable. This issue produces a spec document and TypeScript interface stubs for each component boundary.

**Starting point reference:** pi.dev's "primitives not features" model — the harness exposes a thin RPC/SDK surface and delegates to pluggable components. pi's RPC mode (JSON over stdin/stdout) is a candidate harness implementation; the interface should not preclude it.

#### Acceptance criteria

- [x] `docs/AGENT_ARCHITECTURE.md` created with:
  - [x] Component diagram (text/ASCII) matching the map above
  - [x] Interface contract for each boundary:
    - `HarnessAdapter` - implements ClawFace wire protocol, delegates internally
    - `ModelProvider` - send prompt, receive streaming response, handle tool calls
    - `ToolProvider` - list tools, execute tool, return result
    - `BrowserTool` - navigate, extract, interact (extends `ToolProvider`)
    - `McpServer` - standard MCP protocol surface
  - [x] Notes on which existing open source projects can implement each interface (pi for harness, Lightpanda/Playwright for browser, standard MCP SDKs for tool layer)
  - [x] Compatibility note: pi.dev already handles model provider switching (15+ providers) - the `ModelProvider` interface should be compatible with pi's provider abstraction
- [x] TypeScript interface stubs for each boundary in `agent/interfaces/` (new directory, separate from the mobile app source)
- [x] `AGENTS.md` updated with a note that agent-side work lives in `agent/` and follows `docs/AGENT_ARCHITECTURE.md`

#### Test plan

```bash
npx tsc --noEmit
```

Human review: each interface in `agent/interfaces/` maps to a section in `docs/AGENT_ARCHITECTURE.md`.

#### Files

- `docs/AGENT_ARCHITECTURE.md` (new)
- `agent/interfaces/harness.ts` (new)
- `agent/interfaces/model.ts` (new)
- `agent/interfaces/tool.ts` (new)
- `agent/interfaces/browser.ts` (new)
- `agent/interfaces/mcp.ts` (new)
- `AGENTS.md`

---

### CF-011 - Headless browser tool interface

**Status:** DONE
**Priority:** P1
**Epic:** E - Agent-Side Component Architecture
**Blocked by:** CF-010

#### Description

Define and implement a `BrowserTool` that satisfies the `ToolProvider` interface from CF-010. The first implementation uses Lightpanda (via CDP) for performance; the interface must also be satisfiable by Playwright or a mock for testing.

Lightpanda is CDP-compatible and 9x faster / 16x less memory than Chrome headless. It is open source (AGPL-3.0). For dev/test, a mock implementation that returns static HTML is sufficient.

#### Acceptance criteria

- [x] `agent/interfaces/browser.ts` defines `BrowserTool` extending `ToolProvider` with:
  - `navigate(url: string): Promise<PageSnapshot>`
  - `extract(selector: string): Promise<string>`
  - `click(selector: string): Promise<void>`
  - `type(selector: string, text: string): Promise<void>`
  - `screenshot(): Promise<Buffer>`
- [x] `agent/tools/browser-lightpanda.ts` - Lightpanda implementation using CDP (`chrome-remote-interface` or equivalent)
- [x] `agent/tools/browser-mock.ts` - mock implementation returning static fixtures; used in tests
- [x] Swapping `browser-lightpanda` for `browser-mock` (or Playwright) requires only changing the import in the harness config - no interface changes
- [x] `docs/AGENT_ARCHITECTURE.md` updated: browser section notes Lightpanda as default, Playwright as drop-in alternative

#### Test plan

```bash
npx tsc --noEmit
```

Integration (requires Lightpanda binary):
1. `agent/tools/browser-lightpanda.ts` navigates to `http://example.com` and returns a non-empty `PageSnapshot`
2. Swap to `browser-mock.ts` -> same interface, static fixture returned

#### Files

- `agent/interfaces/browser.ts`
- `agent/tools/browser-lightpanda.ts` (new)
- `agent/tools/browser-mock.ts` (new)
- `docs/AGENT_ARCHITECTURE.md`

---

### CF-012 - Model provider interface

**Status:** DONE
**Priority:** P1
**Epic:** E - Agent-Side Component Architecture
**Blocked by:** CF-010

#### Description

Define a `ModelProvider` interface that abstracts over LLM backends. Users supply their own API keys and choose their provider. The interface must be compatible with pi.dev's provider model (pi supports 15+ providers including Anthropic, OpenAI, Google) so that pi can be dropped in as the harness without an adapter.

#### Acceptance criteria

- [x] `agent/interfaces/model.ts` defines `ModelProvider` with:
  - `complete(messages: Message[], tools: ToolSpec[]): AsyncIterable<CompletionChunk>` (streaming)
  - `modelId: string`
  - `provider: 'anthropic' | 'openai' | 'google' | 'ollama' | string`
- [x] `agent/providers/anthropic.ts` - Anthropic implementation using the Anthropic SDK
- [x] `agent/providers/openai.ts` - OpenAI-compatible implementation (also covers Ollama via base URL override)
- [x] Provider is selected via config (environment variable or harness config file) - no harness code change required to switch
- [x] `docs/AGENT_ARCHITECTURE.md` updated: model section notes config-driven provider selection and pi compatibility

#### Test plan

```bash
npx tsc --noEmit
```

Integration:
1. Set `ANTHROPIC_API_KEY`, send a short prompt -> streaming response received
2. Change provider config to OpenAI-compatible -> same interface, response received

#### Files

- `agent/interfaces/model.ts`
- `agent/providers/anthropic.ts` (new)
- `agent/providers/openai.ts` (new)
- `docs/AGENT_ARCHITECTURE.md`

---

### CF-013 - MCP server integration interface

**Status:** TODO
**Priority:** P1
**Epic:** E - Agent-Side Component Architecture
**Blocked by:** CF-010

#### Description

The harness should discover and call tools via the Model Context Protocol (MCP) rather than hardcoding tool implementations. This allows tools (browser, file system, shell, user-supplied) to be added or removed without changing the harness.

The `McpServer` interface wraps an MCP-compatible server. Tool implementations from CF-011 register themselves as MCP tools. The harness calls tools through MCP exclusively.

#### Acceptance criteria

- [ ] `agent/interfaces/mcp.ts` defines `McpServer` with:
  - `listTools(): Promise<ToolSpec[]>`
  - `callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>`
  - `registerTool(spec: ToolSpec, handler: ToolHandler): void`
- [ ] `agent/mcp/server.ts` - lightweight MCP server implementation (can wrap an existing MCP SDK if suitable one exists for Node.js)
- [ ] Browser tool from CF-011 registers itself via `registerTool` at startup
- [ ] Harness uses `McpServer.listTools()` to build the tool list passed to `ModelProvider.complete()`
- [ ] Adding a new tool requires only: implement `ToolHandler`, call `registerTool` - no other harness changes
- [ ] `docs/AGENT_ARCHITECTURE.md` updated: MCP section notes the tool registration pattern

#### Test plan

```bash
npx tsc --noEmit
```

Integration:
1. Register a mock tool via `registerTool`
2. `listTools()` returns it
3. `callTool` with the mock tool name -> handler called, result returned

#### Files

- `agent/interfaces/mcp.ts`
- `agent/mcp/server.ts` (new)
- `docs/AGENT_ARCHITECTURE.md`

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
| CF-008 | Explicit transport mode: direct vs relay | P2 | TODO | - |
| CF-009 | Persistence schema migration | P2 | TODO | CF-008 |
| CF-010 | Agent-side component architecture spec | P0 | DONE | CF-001 |
| CF-011 | Headless browser tool interface | P1 | DONE | CF-010 |
| CF-012 | Model provider interface | P1 | DONE | CF-010 |
| CF-013 | MCP server integration interface | P1 | TODO | CF-010 |
