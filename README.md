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

### Android cleartext traffic

Production builds disable Android cleartext traffic. For local LAN/WebSocket development builds only, opt in explicitly:

```bash
CLAWFACE_ALLOW_CLEARTEXT=true npm run android
```

Pair only on trusted networks unless your agent serves TLS (`wss://`).
