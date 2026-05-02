# AGENTS.md

## Project

ClawFace is an Expo/React Native AI agent operations app — a mobile command surface for pairing with and controlling trusted AI agents over the OpenClaw Gateway Protocol. Coding agents are the first commercial wedge, not the product identity. See `docs/PRODUCT_CONTEXT.md` and `docs/UBIQUITOUS_LANGUAGE.md` for canonical product framing and vocabulary.

## Commands

- `npm install` — install app dependencies
- `npm run start` — start Expo
- `npm run android` / `npm run ios` / `npm run web` — platform launchers
- `npm run gateway:discover` — run the OpenClaw Gateway discovery/validation probe

## Notes for agents

- Keep session credentials out of AsyncStorage; use `services/secureStore.ts` for session keys.
- Prefer shared color tokens from `constants/colors.ts`; do not add hardcoded hex values in styles.
- Treat WebSocket agent IDs and thread IDs as opaque strings. Do not parse IDs by splitting on delimiters.
- Production Android builds should not enable cleartext traffic. Use `CLAWFACE_ALLOW_CLEARTEXT=true` only for local development.
- Validate with `npx tsc --noEmit` after TypeScript changes.
- This repository is the ClawFace mobile client only. Do not add agent runtimes, model providers, tool harnesses, browser tools, or MCP servers here — those belong to paired agent runtimes (OpenClaw, future plugins) in their own repositories, per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2.
- The only stable contract between ClawFace and any agent runtime is `docs/PROTOCOL.md`. Use vendor-neutral wire-protocol field names (e.g. `agentSessionId`, `agentThreadId`); do not introduce vendor-prefixed field names like `openclawSessionId`.
