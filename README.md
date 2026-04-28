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
- `OPENCLAW_SESSION_ID` / `OPENCLAW_THREAD_ID` (defaults `agent:main:main`) — OpenClaw session keys use the format `agent:<agentName>:<sessionLabel>`. The default targets the default `main` agent's `main` session, matching `openclaw`'s out-of-the-box configuration. If your `openclaw.json` uses a non-default agent name (`openclaw agent --agent ops ...`), set `OPENCLAW_SESSION_ID=agent:ops:main` etc. See https://docs.openclaw.ai for canonical OpenClaw session-key behaviour.
- `OPENCLAW_BIN` (default `openclaw`) — path to the `openclaw` binary the bridge shells out to. Override if the binary is not on `PATH` or if you want to point at a specific build.
- `OPENCLAW_AGENT_ARGS` (default `--local --timeout 120`) — extra args appended after `--session-id … --message … --json`. The default forces the local embedded runtime so the bridge does not silently rely on an OpenClaw Gateway. Override if you need different OpenClaw flags (e.g. `--verbose on`, `--thinking medium`).
- `OPENCLAW_TURN_TIMEOUT_MS` (default `130000`) — wall-clock timeout for the bridge process supervising one `openclaw agent` invocation.

Paste the printed JSON or `clawface://...` source into the pair screen. The paired agent and new threads display the repo/session context so replies cannot silently route through a global chat context.

#### Verifying a real OpenClaw turn vs the bridge fallback

The bridge does not pretend a successful turn happened when the `openclaw` CLI is missing or broken. To confirm a real OpenClaw turn:

- Bridge stdout shows `[openclaw] turn ok session=...` after each user message.
- The ClawFace thread shows the existing tool chip with `status: 'done'` and an `agent` reply with the OpenClaw response text.

If the CLI is unreachable, the bridge instead:

- Logs `[openclaw] FALLBACK cli unavailable session=... bin=... detail=...` to stdout.
- Emits a `tool` chip with `name: 'openclaw_cli_unavailable'`, `status: 'failed'`, and the adapter detail in `result`.
- Does **not** emit a `role: 'agent'` reply. The thread shows no fake OpenClaw response — only the failed tool chip.

If you see a failed `openclaw_cli_unavailable` chip, fix `OPENCLAW_BIN` / `OPENCLAW_AGENT_ARGS` (or install OpenClaw) and try again.

Current bridge limitations:

- The bridge invokes `openclaw agent --session-id ... --message ... --json` followed by `OPENCLAW_AGENT_ARGS`. That signature follows https://docs.openclaw.ai/tools/agent-send. If a future OpenClaw build changes the flag layout, override `OPENCLAW_AGENT_ARGS` accordingly.
- Approval cards are intentionally not bridged here; that belongs to CF-015 (Post-M1).
- Unpairing sends `revoke_session`; the bridge then rejects the old session key.

### Android cleartext traffic

Production builds disable Android cleartext traffic. For local LAN/WebSocket development builds only, opt in explicitly:

```bash
CLAWFACE_ALLOW_CLEARTEXT=true npm run android
```

Pair only on trusted networks unless your agent serves TLS (`wss://`).
