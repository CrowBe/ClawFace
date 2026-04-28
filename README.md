# ClawFace

ClawFace is an Expo mobile client for monitoring and controlling paired OpenClaw-style coding agents from a phone.

## What it does

- Pair with a local agent via QR code or pasted pairing payload.
- Keep agent/session metadata locally, with session keys stored in SecureStore.
- Open agent threads, send messages, and respond to approval requests.
- Receive agent notifications through Expo Notifications.
- Run against a bundled WebSocket dev server for local testing.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the canonical product architecture and trust-boundary plan.
- [`docs/SCALING_AND_UNIT_ECONOMICS.md`](docs/SCALING_AND_UNIT_ECONOMICS.md) covers business model, cost drivers, quotas, and scaling considerations.
- [`docs/BACKLOG.md`](docs/BACKLOG.md) tracks the architecture execution backlog; it should link back to canonical docs rather than become a competing source of truth.

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

### OpenClaw local bridge MVP

The real local bridge is separate from the mock dev server. It binds ClawFace to one explicit local OpenClaw target: repo path, branch, OpenClaw session id, and thread id.

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

Current CF-014 limitations:

- The bridge uses `openclaw agent --session-id ... --message ... --json` as a narrow local adapter. If that CLI path is unavailable, it returns an explicit local fallback echo and a routed completion event for testability.
- Approval cards are intentionally not bridged here; that belongs to CF-015.
- Unpairing sends `revoke_session`; the bridge then rejects the old session key.

### Android cleartext traffic

Production builds disable Android cleartext traffic. For local LAN/WebSocket development builds only, opt in explicitly:

```bash
CLAWFACE_ALLOW_CLEARTEXT=true npm run android
```

Pair only on trusted networks unless your agent serves TLS (`wss://`).
