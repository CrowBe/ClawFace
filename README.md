# ClawFace

ClawFace is an Expo mobile **AI agent operations app**: a mobile command surface for supervising, messaging, and safely directing work across trusted AI agents and workstreams. The first commercial wedge is technical users supervising local OpenClaw-style coding agents, but the product is not coding-specific. See [`docs/PRODUCT_CONTEXT.md`](docs/PRODUCT_CONTEXT.md) for canonical product framing.

## What it does

- Pair with a local agent via QR code or pasted pairing payload.
- Keep agent/session metadata locally, with session keys stored in SecureStore.
- Open agent threads, send messages, and respond to approval requests.
- Receive agent notifications through Expo Notifications.
- Run against a bundled WebSocket dev server for local testing.

## Documentation

- [`docs/PRODUCT_CONTEXT.md`](docs/PRODUCT_CONTEXT.md) is the canonical product vision, audience, promises, non-goals, and milestone framing.
- [`docs/UBIQUITOUS_LANGUAGE.md`](docs/UBIQUITOUS_LANGUAGE.md) is the canonical product/domain vocabulary (Workstream, Thread, Trusted Agent, Agent Operator, Handoff, Agent Context, etc.).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the canonical product architecture and trust-boundary plan.
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md) is the canonical wire-protocol spec between ClawFace and any agent runtime.
- [`docs/SCALING_AND_UNIT_ECONOMICS.md`](docs/SCALING_AND_UNIT_ECONOMICS.md) covers business model, cost drivers, quotas, and scaling considerations.
- [`docs/BACKLOG.md`](docs/BACKLOG.md) tracks the architecture execution backlog; it links back to canonical docs rather than becoming a competing source of truth.

ClawFace does not implement an agent runtime, model provider, tool harness, or MCP server in this repository (per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2). Production agent runtimes (OpenClaw, future plugins) own their own architecture and live in their own repositories. The only stable contract is `docs/PROTOCOL.md`.

## Development

```bash
npm install
npm run start
```

Run the mock pairing server in another shell:

```bash
npm run dev:server
```

Paste the server's printed JSON payload into the app's pairing screen.

### OpenClaw local bridge

`scripts/openclaw-bridge.js` is a thin WebSocket-to-CLI adapter that lets ClawFace pair with a local OpenClaw install for end-to-end testing of the wire protocol. It is not an agent runtime — it shells out to a separately-installed `openclaw` binary and translates between the ClawFace wire protocol and the OpenClaw CLI.

It binds ClawFace to one explicit local OpenClaw target: repo path, branch, OpenClaw session id, and thread id. The wire-protocol fields it advertises (`agentSessionId`, `agentThreadId`) are vendor-neutral so other adapters can satisfy the same contract without changing the mobile client.

```bash
# from this repo
OPENCLAW_SESSION_ID=agent:main:main \
OPENCLAW_THREAD_ID=agent:main:main \
npm run bridge:openclaw
```

Optional environment variables:

- `PORT` (default `8766`)
- `CLAWFACE_REPO_PATH` (default current directory)
- `OPENCLAW_SESSION_ID` / `OPENCLAW_THREAD_ID` (defaults `agent:main:main`)

Paste the printed JSON or `clawface://...` source into the pair screen. The paired agent and new threads display the repo/session context so replies cannot silently route through a global chat context.

Current bridge limitations:

- The bridge uses `openclaw agent --session-id ... --message ... --json` as a narrow local adapter. If that CLI path is unavailable, it returns an explicit local fallback echo and a routed completion event for testability.
- Approval cards are intentionally not bridged here; that belongs to CF-015.
- Unpairing sends `revoke_session`; the bridge then rejects the old session key.

### Android cleartext traffic

Production builds disable Android cleartext traffic. For local LAN/WebSocket development builds only, opt in explicitly:

```bash
CLAWFACE_ALLOW_CLEARTEXT=true npm run android
```

Pair only on trusted networks unless your agent serves TLS (`wss://`).
