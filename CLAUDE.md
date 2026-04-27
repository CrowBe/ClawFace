# ClawFace

Mobile agentic-workflow client — a single app for managing multiple AI coding agents (OpenClaw, Claude Code, etc.) with per-agent threads, inline approvals, and QR pairing. Aims to replace ad-hoc use of Telegram/WhatsApp for agent I/O.

## Documentation source of truth

- [README.md](README.md) is the project overview and setup entry point.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the canonical architecture, product-surface, trust-boundary, pairing/session, approval, and hosted-vs-local responsibility document.
- [docs/SCALING_AND_UNIT_ECONOMICS.md](docs/SCALING_AND_UNIT_ECONOMICS.md) covers market positioning, business model, cost drivers, quotas, abuse controls, and scaling scenarios.
- Do not create overlapping architecture/business planning docs. Update the canonical doc for the concern instead.

## Stack

- **Expo ~54** + **React Native 0.81** + **React 19** (new architecture enabled)
- **expo-router ^55** — file-system routing under `app/`
- **zustand ^5** — single store at [store/index.ts](store/index.ts)
- **react-native-svg** — all icons are inline SVG components
- **TypeScript strict** — path alias `@/*` → repo root (see [tsconfig.json](tsconfig.json))
- No formal test runner or linter config yet; TypeScript typecheck is the current lightweight validation gate

## Running

```bash
npm run android   # primary target — the user tests on Android
npm run ios
npm run web
```

The entry point is `index.ts` → `expo-router/entry`. [App.tsx](App.tsx) is the leftover Expo template file and is unused.

## Target platform

**Android is the primary dev/test target.** The user runs on Android, so prioritize Android behavior when making trade-offs (e.g. `edgeToEdgeEnabled: true` in [app.json](app.json), `predictiveBackGestureEnabled: false`). iOS should still work but isn't the validation surface. Web is incidental.

## Routing / screen map

All routes live under `app/`. The Stack is configured in [app/_layout.tsx](app/_layout.tsx) with `headerShown: false` and a tan background (`C.bg`).

| Route | File | Purpose |
|---|---|---|
| `/` | [app/index.tsx](app/index.tsx) | Agents list + Inbox toggle + tab bar |
| `/threads/[agentId]` | [app/threads/[agentId].tsx](app/threads/[agentId].tsx) | Threads for one agent (flat or folder view) |
| `/chat/[agentId]/[threadId]` | [app/chat/[agentId]/[threadId].tsx](app/chat/[agentId]/[threadId].tsx) | Conversation with inline tool calls + approval cards |
| `/pair` | [app/pair.tsx](app/pair.tsx) | QR pairing flow (slides from bottom) |
| `/config/[agentId]` | [app/config/[agentId].tsx](app/config/[agentId].tsx) | Per-agent permissions + notification settings |
| `/alerts` | [app/alerts.tsx](app/alerts.tsx) | Global notifications/approvals inbox |
| `/me` | [app/me.tsx](app/me.tsx) | User/global settings |

The tab bar ("Agents / Alerts / Me") is rendered inline in [app/index.tsx](app/index.tsx) — it is not a real expo-router Tabs layout. Tapping Alerts/Me pushes those routes; Agents is the root.

## State

Single zustand store: [store/index.ts](store/index.ts). State is initialized from seed data in [data/seed.ts](data/seed.ts), then hydrated from AsyncStorage via [services/persistence.ts](services/persistence.ts). Session keys live in SecureStore via [services/secureStore.ts](services/secureStore.ts) and should not be persisted in AsyncStorage. Key shape:

- `agents: Agent[]` — paired agents with `perms` (`read`/`write`/`shell`/`network`, each `true | false | 'ask'`) and `notifs`
- `threads: Thread[]` — each thread has `messages: Message[]` where a message is one of `user | agent | tool | approval`
- Derived selectors: `agentsWithPending()` and `pendingCount()` drive badges across the UI

Mutations (`resolveApproval`, `sendMessage`, `addAgent`) also set a transient `toast` string and clear it via `setTimeout`. When wiring a real backend, keep the derived-selector shape so badge logic stays unchanged.

## Design system

Colors are the single source of truth: [constants/colors.ts](constants/colors.ts) (`import { C } from '@/constants/colors'`). Warm paper/cream palette (`bg: #FAF7F0`) with burnt-orange accent (`accent: #C8531C`). **Use `C.*` tokens — don't hardcode hex values.**

UI primitives in [components/](components/): `Avatar`, `Drawer`, `Toast`, `Toggle`, `ApprovalCard`, `ToolCallChip`, and SVG `Icons`. All styling is inline `StyleSheet.create` — no styled-components, no theme provider beyond the colour constants.

Safe-area handling: screens call `useSafeAreaInsets()` and apply padding manually (see [app/index.tsx:158](app/index.tsx:158)). `SafeAreaProvider` wraps the Stack in `_layout.tsx`.

## Status & direction

- **UI polish and real agent transport are both in scope.** Design parity with the original mockups is close but not final; hardening the real pairing/transport path is the next major thrust.
- The app now has AsyncStorage persistence, SecureStore session-key handling, WebSocket transport, and a bundled dev pairing server. Treat the dev server as local test infrastructure, not production hosted architecture.
- Future hosted relay/control-plane work must follow [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALING_AND_UNIT_ECONOMICS.md](docs/SCALING_AND_UNIT_ECONOMICS.md). Do not duplicate those decisions here.

## Ignore

- `project/` and `chats/` — the original Claude Design handoff bundle (HTML prototypes + chat transcripts). Treated as archive. The RN code in `app/`, `components/`, `store/`, `data/` is canonical; don't cross-reference the mockups for new work.
- [App.tsx](App.tsx) — stale Expo template, not in the render tree.

## Conventions

- Path imports use `@/` (e.g. `@/store`, `@/components/Avatar`). Don't use relative `../../` imports.
- SVG icons are defined as small components in [components/Icons.tsx](components/Icons.tsx) or inline in the screen that uses them (see `AgentsTabIcon` etc. in `app/index.tsx`). Accept a `color` prop.
- Message `role` is a discriminated union — when adding new message types, extend the `Message` interface in [data/seed.ts](data/seed.ts) and the render switch in the chat screen.
- Agents have a short `mono` (2-letter monogram) and a `tint` used by `Avatar`. New agents default to a lavender tint in `addAgent`.
