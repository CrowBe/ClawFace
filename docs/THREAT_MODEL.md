# ClawFace Threat Model

Status: Draft
Created: 2026-05-08

This document is a structured view onto the security decisions in `docs/ARCHITECTURE.md` §5 (Trust Boundary) and §6 (Architectural Guardrails). It does not redefine those decisions. When a decision changes, update `docs/ARCHITECTURE.md` first and let this file follow.

Related documents:

- `docs/ARCHITECTURE.md` — canonical product architecture, trust boundary, and architectural guardrails
- `docs/PRODUCT_CONTEXT.md` — product non-goals that constrain the trust surface
- `docs/PROTOCOL.md` — concrete wire-protocol behaviour and replay/expiry semantics
- `docs/PRIVACY_POLICY.md` — user-facing data-handling commitments
- `docs/BACKLOG.md` — executable issues that own each mitigation

Re-evaluate this document when:

- a new transport mode is added (relay, BLE, anything beyond direct WebSocket / OpenClaw Gateway)
- a new identity surface is added (account model, multi-device, team mode)
- a new content category is captured by the app (transcript history, audit logs, screenshots)
- an upstream partner (OpenClaw Gateway) changes its auth, revocation, or replay-protection model
- the product expands beyond the Agent Operator audience defined in `docs/PRODUCT_CONTEXT.md`

---

## 1. Scope

In scope:

- the ClawFace Expo/React Native app on Android and iOS
- the OpenClaw Gateway transport (`services/transport/openclaw-gateway.ts`)
- the future hosted relay transport (CF-042) and account model (CF-043)
- pairing, session-key, device-token, and account-credential lifecycle
- approval/Handoff decision flow on the mobile surface
- push notification delivery routing

Out of scope:

- the internals of any paired Agent runtime (per `docs/PRODUCT_CONTEXT.md` non-goals 1 and 2 — ClawFace is not the agent runtime, model provider, or tool/MCP host)
- OpenClaw's own threat model (their Gateway, server, and node software defend their own surface)
- the security of the user's development machine, shell, or repository
- the security of the web billing portal beyond the entitlement API contract (CF-030)

---

## 2. Assets

| Asset | Where it lives | Why it matters |
|---|---|---|
| **Session key** (legacy direct transport) | `services/secureStore.ts` (SecureStore) | Authorises the mobile client to act as an operator on a paired endpoint |
| **Gateway device token** | `services/secureStore.ts` (SecureStore) | Bearer credential for the OpenClaw Gateway; full operator capability on issuance |
| **Mobile Ed25519 device seed** | `services/secureStore.ts` (SecureStore) | Proves device identity in the Gateway `connect.challenge` handshake |
| **Pairing fingerprint** | One-shot, scanned/pasted | Binds the pairing handshake to the intended server (CF-002) |
| **`reqId` for approvals** | In-flight transport state, transient store state | Replay protection for security-sensitive approve/deny decisions (CF-004) |
| **Message content** (user, agent, tool args/output) | Local AsyncStorage via `services/persistence.ts`; in transit over WebSocket | Includes prompts, code, command output, possibly secrets pasted by the user |
| **Agent Context** (repo path, branch, host, agent display name) | Local AsyncStorage; rendered in UI | Lower sensitivity than message content but still environment-revealing |
| **Approval decisions** | Transient transport messages; rendered in UI | Authorise consequential agent actions |
| **Push token** (CF-039) | SecureStore once registered | Routing identifier for server-driven notifications |
| **Account credential** (CF-043) | SecureStore | Binds the device to a billing account; required for relay mode |

---

## 3. Adversaries

| Adversary | Capability | Realistic in scope today? |
|---|---|---|
| Passive network observer (Wi-Fi, ISP) | Reads traffic on the wire | Yes — direct mode crosses the LAN; relay mode crosses the public internet |
| Active network attacker (MitM) | Modifies, drops, or replays traffic; presents rogue TLS | Yes |
| Rogue pairing server | Accepts a one-time pairing code and tries to issue a session | Yes — defended by fingerprint check (CF-002) and clientKey HMAC (CF-003) |
| Replayer of valid approval packets | Captures a valid `approval_decision` and replays it later | Yes — defended by `reqId` deduplication (CF-004) and `expiresAt` (CF-006) |
| Compromised hosted relay node | Reads, modifies, or replays anything passing through it | Becomes in-scope at CF-042 — relay must see only opaque payloads (CF-029) |
| Lost or stolen unlocked phone | Has full app access | Mitigation depends on OS lock; revocation path required (CF-005, CF-043) |
| Lost or stolen locked phone | Reads disk but not memory; cannot interact with app | SecureStore + platform keystore is the boundary |
| Malicious paired Agent runtime | Sends malformed frames, forged approvals, oversized payloads | Partially in scope — normalizer (CF-018) and policy limits (CF-027) defend frame-shape; semantic trust in the runtime is *not* defended |
| Hostile other app on the device | Uses Android intents, accessibility services, or shared storage to read state | OS sandboxing is the boundary; `expo-secure-store` for secrets, no world-readable files |
| OS-level attacker (root, custom ROM) | Bypasses sandbox | Out of scope; ClawFace cannot defend against a compromised OS |
| Telemetry pipeline operator (CF-035) | Sees what the app reports | Defended by the redaction allowlist; user can opt out |

---

## 4. Mitigations

| Threat | Mitigation | Owner |
|---|---|---|
| Rogue pairing server | Fingerprint comparison aborts session on mismatch | CF-002 |
| Stolen pairing code in transit | `clientKey` HMAC binds session to initiating client | CF-003 |
| Replayed approval decision | Server-issued `reqId` per request; client and server dedupe | CF-004 |
| Stale approval decision | `expiresAt` excludes expired approvals from action and badges | CF-006 |
| Stale session after unpair / sign-out | `revoke_session` (legacy) and `device.token.revoke` (Gateway) on disconnect | CF-005, CF-026 |
| Replay protection drift across migrations | Forward-only persistence migrations; corrupt-payload fallback returns `null` | CF-009, CF-022 |
| Malformed transport frames crashing the app | Normalizer validates known shapes and surfaces unknowns as controlled notices | CF-018 |
| Oversized inbound/outbound frames | `hello-ok.policy.maxPayload` is honoured; oversized sends are rejected client-side with a notice | CF-027 |
| Unbounded reconnect storm | Bounded exponential backoff with jitter; auth-failed states stop retrying | CF-032 |
| Unbounded local transcript growth | Per-thread message cap and global byte budget enforced at persistence | CF-033 |
| Protocol version skew with Gateway | Distinct error states (`protocol_too_new` / `protocol_too_old`); reconnect does not retry | CF-034 |
| Telemetry leaking message content | Allowlist-based `beforeSend` redaction; user opt-out | CF-035 |
| User cannot diagnose a hung connection without exposing content | Read-only diagnostics screen with frame-kind ring buffer; explicitly excludes payloads | CF-036 |
| Regressions in security-sensitive code paths | Jest test harness covers normalizer, persistence migrations, store reducers, redaction allowlist; CI gates merges | CF-037 |
| Notification fatigue / noisy agent abuse | Per-agent quiet hours, severity filter, rate cap with coalescing | CF-038 |
| Push payload leaking content | Push payloads carry routing metadata only; static title/body | CF-039 |
| User cannot delete their data | "Delete all data" wipes AsyncStorage + SecureStore + diagnostics buffer; relay-side request when account exists | CF-040 |
| Hosted relay reading message content | X25519 key agreement during pairing + XChaCha20-Poly1305 envelope encryption; relay sees only routing metadata | CF-029 |
| Compromised relay node forging messages | Authenticated encryption (Poly1305 tag) rejects tampered payloads | CF-029 |
| Account/device confusion across multiple installs | Account/device identity model with per-device Ed25519 + server-issued account credential; per-device revocation from the web portal | CF-043 |
| Push token misrouted across devices | Push token bound to account/device pair on registration | CF-039, CF-043 |
| Sensitive payloads in push notifications | Payload contract documents routing-only fields; no body text | CF-039 |
| Hosted compute drift (relay running agents) | Architectural guardrail 1 in `docs/ARCHITECTURE.md` §6; not a code mitigation, a product non-goal enforced by review | `docs/ARCHITECTURE.md` §6 |
| Plaintext content in hosted control plane | Architectural guardrail 3; transcript/history features explicitly out of scope without encryption + pricing | `docs/ARCHITECTURE.md` §5 |

---

## 5. Accepted Risks

These are risks ClawFace explicitly does not attempt to mitigate. They are documented here so that future contributors do not file them as bugs.

- **A malicious paired Agent runtime can lie to the user.** ClawFace renders the Agent runtime's frames. If the runtime is compromised or hostile, it can fabricate messages, fabricate Agent Context, or surface approval requests that misrepresent the action they authorise. The trust boundary is the user's decision to pair the runtime in the first place. ClawFace does defend frame *shape* (CF-018) and rate (CF-027, CF-038); it does not defend frame *truth*.
- **A user with an unlocked, signed-in phone has full app access.** Device-level lock is the boundary. ClawFace does not implement an in-app PIN or biometric gate. Users who need this should use OS-level app-lock features.
- **The user pasting secrets into a chat exposes those secrets to the paired Agent runtime.** ClawFace transports user input verbatim to the runtime. It does not scan, redact, or warn on content.
- **Connection presence and message size are visible to the relay by design (CF-029, `docs/ARCHITECTURE.md` §5).** Padding can mitigate size leaks; presence cannot be hidden from a routing layer that needs to deliver messages. Forward secrecy (Double Ratchet) is a future enhancement, not a current property.
- **OpenClaw Gateway's own auth, revocation, and replay-protection model is trusted as upstream.** ClawFace consumes Gateway-issued tokens and trusts Gateway-issued `reqId` semantics. If OpenClaw's posture changes, ClawFace's posture changes with it. Re-evaluation triggered by the corresponding upstream change.
- **Telemetry is opt-out, not opt-in by default.** This is a deliberate trade-off for crash diagnosis; the mitigation is the redaction allowlist (CF-035) and an obvious toggle on `/me`.
- **Local AsyncStorage is not encrypted at rest beyond what the OS provides.** SecureStore covers secrets. Message content lives in AsyncStorage and is protected by the OS sandbox, not by app-level encryption. CF-033 limits the blast radius via retention.

---

## 6. Out of Scope

- **Defending against a compromised user device (rooted, custom ROM, malicious OS).** The OS sandbox is the boundary.
- **Defending against the user's own Agent runtime, repo, or development environment.** ClawFace does not own those surfaces.
- **Hosted compute for agents.** Architectural guardrails 1 and 2 in `docs/ARCHITECTURE.md` §6 forbid it. If this changes, this document and the architecture document both need re-evaluation.
- **Long-term encrypted transcript hosting.** Out of scope until the encryption, retention, and pricing model are explicit (per `docs/ARCHITECTURE.md` §5 and `docs/SCALING_AND_UNIT_ECONOMICS.md` §3).
- **OpenClaw protocol-level vulnerabilities.** Reported upstream; ClawFace pins a Gateway protocol version (CF-034) but does not patch OpenClaw.

---

## 7. Re-evaluation Triggers

Open this document and revise it when any of the following change:

- a new transport mode is added (CF-042 hosted relay; future BLE / direct WebRTC)
- a new content category is persisted on-device or transmitted (transcript history, screenshots, audit logs)
- a new identity surface is introduced (CF-043 account model, multi-device, team mode)
- the Agent Operator audience expands beyond the operator wedge defined in `docs/PRODUCT_CONTEXT.md`
- the upstream OpenClaw Gateway changes its auth, revocation, or replay-protection model
- a security-sensitive defect is reported (re-evaluate the matching Mitigation row, not just the patch)
- before each public release: walk the Mitigations table and confirm every "Owner" CF issue is either DONE or has its absence acknowledged in the release notes
