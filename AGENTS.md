# AGENTS.md

## Project

ClawFace is an Expo/React Native app for pairing with and controlling coding agents over WebSockets.

## Commands

- `npm install` — install app dependencies
- `npm run start` — start Expo
- `npm run android` / `npm run ios` / `npm run web` — platform launchers
- `npm run dev:server` — run the local WebSocket pairing/agent simulator

## Notes for agents

- Keep session credentials out of AsyncStorage; use `services/secureStore.ts` for session keys.
- Prefer shared color tokens from `constants/colors.ts`; do not add hardcoded hex values in styles.
- Treat WebSocket agent IDs and thread IDs as opaque strings. Do not parse IDs by splitting on delimiters.
- Production Android builds should not enable cleartext traffic. Use `CLAWFACE_ALLOW_CLEARTEXT=true` only for local development.
- Validate with `npx tsc --noEmit` after TypeScript changes.
