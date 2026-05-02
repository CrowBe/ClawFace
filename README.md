# ClawFace

ClawFace is an Expo mobile **AI agent operations app**: a mobile command surface for supervising, messaging, and safely directing work across trusted AI agents and workstreams. The first commercial wedge is technical users supervising local OpenClaw-style coding agents, but the product is not coding-specific. See [`docs/PRODUCT_CONTEXT.md`](docs/PRODUCT_CONTEXT.md) for canonical product framing.

## What it does

- Pair with a local agent via QR code or pasted pairing payload.
- Connect to OpenClaw as an operator client via the Gateway Protocol.
- Keep agent/session metadata locally, with session keys and Gateway device tokens stored in SecureStore.
- Open agent threads, send messages, and respond to approval requests.
- Receive agent notifications through Expo Notifications.
- Run against a local OpenClaw Gateway.

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

### OpenClaw integration

ClawFace connects to a local OpenClaw instance via the Gateway Protocol. ClawFace pairs directly with a locally-running `openclaw gateway` as an `operator` role client over OpenClaw's documented Gateway WebSocket Protocol. See [OpenClaw Gateway](#openclaw-gateway) below.

### M1 local test path

Use this checklist from a clean start when validating CF-016.

1. Start or confirm the local OpenClaw Gateway is running on `ws://127.0.0.1:18789`.
2. Validate Gateway auth and session surfaces before using the app:

   ```bash
   OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789 \
   OPENCLAW_GATEWAY_TOKEN=<your-token> \
   OPENCLAW_GATEWAY_SCOPES=operator.read,operator.write,operator.pairing \
   OPENCLAW_GATEWAY_SEND_TEXT="Reply with one short sentence for ClawFace validation." \
   npm run gateway:discover
   ```

   Expected: the probe reports `sessions.create`, `sessions.messages.subscribe`, and `sessions.send` success, then captures session-keyed `session.message`, `agent`, and/or `chat` events. The probe must not log message content.
3. Paste a Gateway pairing payload into ClawFace with `transport: "openclaw-gateway"`, host `127.0.0.1`, port `18789`, and a Gateway token or issued device token.
4. Expected in ClawFace: pairing succeeds only after Gateway connect/auth completes, the Trusted Agent shows Gateway-derived Agent Context where available, and recent Gateway sessions appear as Threads keyed by the full opaque Gateway session key.
5. Send one message in a Thread. Expected: the response comes back via OpenClaw Gateway events in the same Thread. Tool activity, when emitted by OpenClaw, should render as real tool chips driven by `session.tool` or session-keyed `agent` tool streams.
6. Unpair. Expected: when ClawFace has a connected signed device identity, it calls `device.token.revoke`, deletes local Gateway token/seed material, and reconnect with the revoked issued token is rejected. Token-only interim pairing falls back to local deletion with a warning.

Known M1 limits: approvals are intentionally Post-M1, and tokenless signed pairing is implemented client-side but currently unvalidated against the local Gateway auth configuration when it reports `AUTH_TOKEN_MISSING`.

### OpenClaw Gateway

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
OPENCLAW_GATEWAY_SEND_TEXT="Reply with one short sentence for ClawFace validation." \
npm run gateway:discover
```

To validate Gateway token revocation for the probe's signed device identity, add `OPENCLAW_GATEWAY_REVOKE_DEVICE_TOKEN=1`. This calls `device.token.revoke` for the ephemeral probe device, then attempts a reconnect with the revoked issued token and expects rejection.

Known limitations:

- Gateway approval resolution currently surfaces a transport notice only; full approval bridging is Post-M1 (see CF-015).
- Device token revocation calls `device.token.revoke` only when a connected signed device identity is available; interim token-only pairing falls back to local credential deletion with a warning.
- Authenticated Gateway discovery, send, event capture, and signed-device token revocation probes have passed locally. Full mobile-app validation remains tracked by CF-026.

### Android cleartext traffic

Production builds disable Android cleartext traffic. For local LAN/WebSocket development builds only, opt in explicitly:

```bash
CLAWFACE_ALLOW_CLEARTEXT=true npm run android
```

Pair only on trusted networks unless your agent serves TLS (`wss://`).
