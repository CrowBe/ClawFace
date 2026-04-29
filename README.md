# ClawFace

ClawFace is an Expo mobile **AI agent operations app**: a mobile command surface for supervising, messaging, and safely directing work across trusted AI agents and workstreams. The first commercial wedge is technical users supervising local OpenClaw-style coding agents, but the product is not coding-specific. See [`docs/PRODUCT_CONTEXT.md`](docs/PRODUCT_CONTEXT.md) for canonical product framing.

## What it does

- Pair with a local agent via QR code or pasted pairing payload.
- Connect to OpenClaw as an operator client via the Gateway Protocol (path B), or through the legacy CLI bridge (path A).
- Keep agent/session metadata locally, with session keys and Gateway device tokens stored in SecureStore.
- Open agent threads, send messages, and respond to approval requests.
- Receive agent notifications through Expo Notifications.
- Run against a bundled WebSocket dev server, the OpenClaw CLI bridge, or a local OpenClaw Gateway.

## Documentation

- [`docs/PRODUCT_CONTEXT.md`](docs/PRODUCT_CONTEXT.md) is the canonical product vision, audience, promises, non-goals, and milestone framing.
- [`docs/UBIQUITOUS_LANGUAGE.md`](docs/UBIQUITOUS_LANGUAGE.md) is the canonical product/domain vocabulary (Workstream, Thread, Trusted Agent, Agent Operator, Handoff, Agent Context, etc.).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the canonical product architecture and trust-boundary plan.
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md) is the canonical wire-protocol spec between ClawFace and any agent runtime.
- [`docs/SCALING_AND_UNIT_ECONOMICS.md`](docs/SCALING_AND_UNIT_ECONOMICS.md) covers business model, cost drivers, quotas, and scaling considerations.
- [`docs/BACKLOG.md`](docs/BACKLOG.md) tracks the architecture execution backlog; it links back to canonical docs rather than becoming a competing source of truth.
- [`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md) is the draft Privacy Policy for Google Play Store deployment.

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

### OpenClaw integration

ClawFace has two paths for connecting to a local OpenClaw instance:

- **Path B — OpenClaw Gateway Protocol (recommended).** ClawFace pairs directly with a locally-running `openclaw gateway` as an `operator` role client over OpenClaw's documented Gateway WebSocket Protocol. This is the production-transport-shaped path. See [OpenClaw Gateway](#openclaw-gateway-path-b) below.
- **Path A — Legacy CLI bridge.** ClawFace pairs with `scripts/openclaw-bridge.js`, which shells out to the `openclaw` CLI. Lower friction to set up, lower fidelity to the production transport. See [OpenClaw local bridge](#openclaw-local-bridge-path-a) below.

### M1 local test path

Use this checklist from a clean start when validating CF-016. Path B is the recommended production-shaped path; Path A remains the legacy fallback for users running only the OpenClaw CLI. Do not count the mock dev server as M1 validation.

**Path B — Gateway Protocol**

1. Start or confirm the local OpenClaw Gateway is running on `ws://127.0.0.1:18789`.
2. Validate Gateway auth and session surfaces before using the app:

   ```bash
   OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 \
   OPENCLAW_GATEWAY_TOKEN=<your-token> \
   OPENCLAW_GATEWAY_SCOPES=operator.read,operator.write,operator.pairing \
   OPENCLAW_GATEWAY_SEND_TEXT="Reply with one short sentence for ClawFace path B validation." \
   npm run gateway:discover
   ```

   Expected: the probe reports `sessions.create`, `sessions.messages.subscribe`, and `sessions.send` success, then captures session-keyed `session.message`, `agent`, and/or `chat` events. The probe must not log message content.
3. Paste a Gateway pairing payload into ClawFace with `transport: "openclaw-gateway"`, host `127.0.0.1`, port `18789`, and a Gateway token or issued device token.
4. Expected in ClawFace: pairing succeeds only after Gateway connect/auth completes, the Trusted Agent shows Gateway-derived Agent Context where available, and recent Gateway sessions appear as Threads keyed by the full opaque Gateway session key.
5. Send one message in a Thread. Expected: the response comes back via OpenClaw Gateway events in the same Thread, not via the mock server or bridge fallback. Tool activity, when emitted by OpenClaw, should render as real tool chips driven by `session.tool` or session-keyed `agent` tool streams.
6. Unpair. Expected: when ClawFace has a connected signed device identity, it calls `device.token.revoke`, deletes local Gateway token/seed material, and reconnect with the revoked issued token is rejected. Token-only interim pairing falls back to local deletion with a warning.

**Path A — legacy CLI bridge fallback**

1. Start the bridge from this repo. Override env vars only when your local OpenClaw target differs from the defaults:

   ```bash
   CLAWFACE_REPO_PATH=$PWD \
   OPENCLAW_BIN=openclaw \
   OPENCLAW_SESSION_ID=main \
   OPENCLAW_THREAD_ID=main \
   OPENCLAW_AGENT_ARGS="--local --timeout 120" \
   OPENCLAW_TURN_TIMEOUT_MS=130000 \
   npm run bridge:openclaw
   ```

2. Start Expo in another shell with local cleartext allowed when testing Android over `ws://`:

   ```bash
   CLAWFACE_ALLOW_CLEARTEXT=true npm run android
   ```

   For iOS/simulator or Expo Go workflows, use the matching Expo command and paste the bridge payload manually if deep links are unavailable.
3. Paste the bridge's printed JSON or `clawface://...` URL into the pairing screen.
4. Expected in ClawFace: pairing succeeds, the Trusted Agent and bound Thread show repo/session metadata from the bridge payload, and all replies stay in the bound Thread.
5. Send one message. Expected: bridge stdout shows `[openclaw] turn ok session=...`; the Thread shows the normal tool chip with `status: 'done'` and a real OpenClaw `agent` reply. If stdout shows `[openclaw] FALLBACK cli unavailable ...`, the Thread must show only the failed `openclaw_cli_unavailable` tool chip and no fake agent reply. Fix `OPENCLAW_BIN` / `OPENCLAW_AGENT_ARGS` before counting the run as valid.
6. Unpair. Expected: the bridge receives `revoke_session` and rejects reuse of the old session key.

Known M1 limits: approvals are intentionally Post-M1, path A binds one explicit OpenClaw session/thread per bridge instance, and path B tokenless signed pairing is implemented client-side but currently unvalidated against the local Gateway auth configuration when it reports `AUTH_TOKEN_MISSING`.

Latest CF-016 validation: on 2026-04-30, path A was validated against a real local `openclaw agent --local` turn from a clean bridge pair. The run produced the expected `openclaw_agent` running chip, real agent reply, `openclaw_agent` done chip, no fallback chip, and rejected reconnect after `revoke_session`.

### OpenClaw Gateway (path B)

ClawFace can connect directly to a running OpenClaw Gateway as an operator client. The app transport (`services/transport/openclaw-gateway.ts`) implements Gateway Protocol v3: `connect.challenge`/`connect` handling, token/device-token authentication, `sessions.send` for user turns, `sessions.messages.subscribe` for streamed events, and `sessions.create` for new threads. Mobile device signing is wired with a per-agent Ed25519 identity stored in SecureStore.

To pair ClawFace with a local Gateway, construct a pairing payload with `transport: "openclaw-gateway"` and paste it into the app's pair screen:

```json
{
  "v": 2,
  "host": "127.0.0.1",
  "port": 18789,
  "transport": "openclaw-gateway",
  "token": "<your-gateway-auth-token>",
  "name": "OpenClaw Gateway",
  "context": {
    "repoName": "my-project",
    "agentSessionId": "agent:main:main"
  }
}
```

The `token` field is optional. When present, it should contain a Gateway-accepted auth token (the same token used with `npm run gateway:discover`). When omitted, ClawFace attempts the signed Gateway device-pairing flow so OpenClaw can ask the operator to approve the mobile device. The optional `context` field populates Agent Context display in the app.

Once paired, ClawFace stores any supplied Gateway credential, and any `hello-ok.auth.deviceToken` issued by the Gateway, in SecureStore and routes communication through the Gateway transport. Streamed Gateway events (`session.message`, `chat`, `session.tool`, and session-keyed `agent` assistant/tool/command-output streams) are normalized into ClawFace's message model; unknown or unkeyed `agent` streams surface as controlled notices.

To validate Gateway connectivity before pairing:

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=<your-token> \
npm run gateway:discover
```

For an opt-in local round-trip probe, provide a send text and write-capable scopes. This sends a real turn to OpenClaw and prints only summarized event shapes, not message content:

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=<your-token> \
OPENCLAW_GATEWAY_SCOPES=operator.read,operator.write,operator.pairing \
OPENCLAW_GATEWAY_SEND_TEXT="Reply with one short sentence for ClawFace path B validation." \
npm run gateway:discover
```

To validate Gateway token revocation for the probe's signed device identity, add `OPENCLAW_GATEWAY_REVOKE_DEVICE_TOKEN=1`. This calls `device.token.revoke` for the ephemeral probe device, then attempts a reconnect with the revoked issued token and expects rejection.

Known path B limitations:

- Gateway approval resolution currently surfaces a transport notice only; full approval bridging is Post-M1 (see CF-015).
- Device token revocation calls `device.token.revoke` only when a connected signed device identity is available; interim token-only pairing falls back to local credential deletion with a warning.
- Authenticated Gateway discovery, send, event capture, and signed-device token revocation probes have passed locally. Full mobile-app path B validation remains tracked by CF-026.

### OpenClaw local bridge (path A)

`scripts/openclaw-bridge.js` is a thin WebSocket-to-CLI adapter that lets ClawFace pair with a local OpenClaw install for end-to-end testing of the legacy wire protocol. It is not an agent runtime — it shells out to a separately-installed `openclaw` binary and translates between the ClawFace wire protocol and the OpenClaw CLI. This is the legacy fallback for users running `openclaw agent` CLI without a Gateway.

It binds ClawFace to one explicit local OpenClaw target: repo path, branch, OpenClaw session id, and thread id. The wire-protocol fields it advertises (`agentSessionId`, `agentThreadId`) are vendor-neutral so other adapters can satisfy the same contract without changing the mobile client.

```bash
# from this repo
OPENCLAW_SESSION_ID=main \
OPENCLAW_THREAD_ID=main \
npm run bridge:openclaw
```

Optional environment variables:

- `PORT` (default `8766`)
- `CLAWFACE_REPO_PATH` (default current directory)
- `OPENCLAW_SESSION_ID` / `OPENCLAW_THREAD_ID` (defaults `main`) — path A passes `OPENCLAW_SESSION_ID` to `openclaw agent --session-id`, so it must be a safe CLI session id such as `main` or `clawface-m1`, not a Gateway session key like `agent:main:main`. Use `OPENCLAW_AGENT_ARGS` / `OPENCLAW_BIN` for CLI behavior overrides; Gateway session keys belong to path B.
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
