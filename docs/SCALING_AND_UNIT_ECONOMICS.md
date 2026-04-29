# ClawFace Scaling and Unit Economics

Status: Draft
Created: 2026-04-27
Updated: 2026-04-29
Play Store and monetisation analysis: 2026-04-29

This document covers ClawFace's business model, cost drivers, quotas, abuse posture, and scaling considerations.

Architecture belongs in `docs/ARCHITECTURE.md`. This file should not redefine product surfaces, trust boundaries, pairing semantics, approval semantics, or hosted/local responsibilities except where needed to explain cost or packaging implications. The executable task backlog lives in `docs/BACKLOG.md` and should not duplicate the economic assumptions here.

---

## 1. Market Read

ClawFace's product framing lives in `docs/PRODUCT_CONTEXT.md` (AI agent operations app for **Agent Operators**). The audience is broader than developers, but the **first commercial wedge** is technical users supervising coding agents — they have the highest current pain, the most willingness to pay, and the most existing tooling that makes pairing realistic.

ClawFace has a different premise and target market from ScrolLess.

ScrolLess is a privacy-sensitive feed product with a possible consumer/prosumer SaaS path. ClawFace is narrower and more technical at the start:

- the first commercial wedge is technical users running coding agents (OpenClaw-style)
- the longer-term audience is broader Agent Operators across sales/CRM, ops, and personal-assistant-style agents (per `docs/PRODUCT_CONTEXT.md` target audience)
- willingness to pay is tied to oversight, remote control, and operational safety — not raw productivity for any one role
- adoption depends on reliability, trust, and integration quality
- the market is smaller than consumer SaaS, but each user may have higher professional value
- the app must feel safe before it feels delightful

This means ClawFace should not chase broad free consumer growth. It should prioritise credibility with serious agent operators — starting with coding-agent users, where the wedge is sharpest.

---

## 2. Business Model Read

The strongest model is an **agent-operations tool with optional hosted convenience**, sold first into the coding-agent operator wedge.

The local-first app and protocol build trust. Paid value should come from hosted convenience and operational features that are hard to deliver purely locally.

Recommended packaging:

### Free / OSS

- local direct pairing
- one or a few paired agents
- local/dev notification flows where possible
- basic approvals and messaging
- no hosted relay dependency

### Individual Pro

- hosted relay for remote access
- push notifications
- multiple agents/devices
- durable presence
- bounded approval/event history metadata
- faster reconnect/resume

### Team / Studio

- shared agent fleet visibility
- team access controls
- audit logs
- approval policies
- managed device revocation
- SSO later, only if demand exists

This is more credible than trying to monetise a basic mobile app directly. Developers pay for reliability, remote access, and operational safety.

---

## 3. Cost Model

ClawFace has a better cost profile than ScrolLess if it stays within the architecture boundary in `docs/ARCHITECTURE.md`.

Low-cost by design:

- no model inference
- no hosted coding-agent execution
- no headless browsers
- minimal database storage
- push notifications are cheap at low/moderate scale
- relay traffic is mostly text/control messages

Potential cost traps:

1. **Always-on WebSocket relay**
   - many idle connections can become the main infrastructure cost
   - needs connection limits, idle timeout, reconnect backoff, and per-plan quotas
   - the preferred node-per-user/workspace relay pattern improves isolation but may increase baseline per-paying-user cost versus a shared multi-tenant relay
   - "workspace" here is an **infra/tenancy** scope (per-account or per-relay-node), not the product-domain **Workstream** in `docs/UBIQUITOUS_LANGUAGE.md`

2. **Large transcript or tool-output syncing**
   - logs and command output can explode storage and bandwidth
   - default should be metadata-only or short-retention encrypted envelopes
   - any transcript/history feature needs explicit pricing and retention rules

3. **Push notification fanout**
   - usually cheap, but noisy agents could generate excessive notifications
   - needs per-agent notification throttles and user-configurable filters

4. **Teams/audit logs**
   - useful paid feature, but audit retention must be bounded by plan
   - long audit retention is a commercial feature, not a free default

5. **Support burden**
   - pairing, LAN issues, firewalls, mobile push weirdness, and agent compatibility will create support load faster than raw infra cost

6. **App-store monetisation constraints**
   - if paid features are sold inside the app, Apple/Google policy may matter
   - safest path is account/subscription management on web, with the app consuming existing entitlements
   - see §3.1 for current Google Play fee structure and recommended billing strategy

### 3.1 Google Play Fee Structure (March 2026)

Google Play announced a major fee overhaul on March 4, 2026. Public reporting says the first regional rollout starts in 2026, with details varying by market and program. Re-check the current Play Console policy before launch. References: [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622), [9to5Google summary of the March 2026 proposal](https://9to5google.com/2026/03/04/google-vs-epic-games-android-app-stores-lower-fees/).

New fee rates for transactions on new installs:

| Transaction type | Standard | Apps Experience Program | First $1M earnings |
| --- | --- | --- | --- |
| Non-recurring (in-app or external web link) | 20% + billing fee* | 15% + billing fee* | 10% + billing fee* |
| Recurring subscriptions | 10% + billing fee* | 10% + billing fee* | 10% + billing fee* |

*Billing fee = 5% in US/UK/EEA if using Google Play Billing. Not applicable for external web link transactions.

For existing installs, non-recurring rates are 5% higher. Subscription rates remain 10%.

Key takeaway: subscriptions through Google Play Billing appear to be moving toward a lower effective rate than the old 30% default in many markets, but the exact fee depends on region, install cohort, billing option, and program eligibility.

### Recommended billing strategy: web-only billing

ClawFace's target audience (technical users, agent operators) expects to buy developer tools on websites, not through app-store IAP. Recommended approach:

1. **All subscription purchases happen on a web billing portal** (Stripe or similar, ~2.9% + $0.30 per transaction).
2. The app checks entitlements via API — "is this account Pro/Team?" — and unlocks features accordingly.
3. The app itself is a **free download** on the Play Store. No in-app purchase flow is triggered.
4. The app does not link to web billing from inside the app. Users find billing through the marketing website, onboarding emails, or their account dashboard on web.

This is intended to keep billing outside the Play-distributed app, but do not treat it as policy-free. Before launch, validate the current Google Play Payments policy for digital services, entitlement consumption, account creation, and whether any in-app links or calls to action are allowed.

Alternative: if in-app purchase convenience is later desired, the newer lower subscription/service-fee structure may be reasonable. This adds Play Billing Library integration complexity and must be evaluated against the current regional fee table.

### App-store-aware entitlement design

The app should consume entitlements from a web-owned billing system:

- Account/subscription truth lives on the web (Stripe customer portal, account dashboard).
- The mobile app reads entitlement state from the ClawFace API at launch and on-demand.
- No subscription management UI or purchase CTA in the app until current Play policy confirms what is allowed.
- This keeps billing logic out of the mobile codebase and reduces app-store policy risk, but final compliance must be checked before submission.

---

## 4. Suggested Quotas

These are starting assumptions, not final pricing.

### Free

- direct/local pairing by default
- optional very limited hosted relay trial if desired
- 1-2 paired agents
- low notification volume
- no durable hosted transcript storage
- short approval/event metadata retention if hosted relay is used

### Pro

- 5-10 paired agents
- multiple mobile devices
- hosted relay access
- push notifications
- bounded approval/event history retention
- reasonable message/control traffic limits
- priority reconnect/resume behaviour if relay capacity is constrained

### Team

- pooled agent/device limits
- per-seat or per-workspace pricing ("workspace" here means a billing/tenancy scope, not a product-domain Workstream)
- audit retention by plan
- admin revocation
- policy controls
- optional SSO only when demand justifies the maintenance cost

The key is to make expensive behaviours explicit: always-on relay, long retention, audit logs, and large payload sync.

---

## 5. Abuse and Safety Controls as Cost Controls

Required before any hosted launch:

- per-account and per-device rate limits
- max paired agents per plan
- max concurrent relay connections per plan
- idle connection timeouts
- reconnect backoff enforcement
- notification throttling
- approval request expiry
- replay protection for approval decisions
- device revocation path
- agent/session revocation path
- minimal push payloads
- clear audit trail for security-sensitive actions

A hosted relay for trusted AI agents is security-sensitive even if it is not storing code. Treat approval/Handoff actions as privileged operations.

---

## 6. Scaling Scenarios

### 1k users

Expected bottleneck:

- product reliability and pairing UX, not infrastructure cost

Focus:

- robust pairing
- reconnect behaviour
- notification reliability
- clear security model

### 10k users

Expected bottleneck:

- relay connection management and support load

Focus:

- managed WebSocket infrastructure
- quota enforcement
- observability
- incident/debug tooling

### 100k users

Expected bottleneck:

- always-on relay economics
- notification noise
- team/admin complexity
- support processes

Focus:

- regional relay architecture
- a clear shared-vs-isolated relay cost model
- strict plan limits
- retention controls
- enterprise/team support boundaries

If ClawFace reaches this scale, the product is no longer just an app. It is a small remote-control platform for trusted AI agents — with the coding-agent operator wedge as the dominant user shape today.

---

## 7. Senior Developer Story

ClawFace can show robust senior thinking if the project demonstrates:

- local-first trust model
- explicit cost boundaries
- plan-based quota enforcement
- operational observability for connection state and notification delivery
- app-store-aware entitlement design
- a clear line between free local utility and paid hosted convenience

The strongest commercial story is:

> ClawFace is a secure mobile control plane for trusted AI agents that already run on user-controlled machines or infrastructure. The first commercial wedge is operators of local or self-hosted coding agents (OpenClaw-style). ClawFace keeps agent execution, model inference, and sensitive content out of the hosted service by default, while offering paid hosted relay, notifications, and team controls where convenience justifies the cost.

---

## 8. Near-term Business/Economics Priorities

1. Define free/pro/team limits before implementing hosted relay.
2. Decide whether hosted relay is paid-only or has a constrained free trial.
3. Set initial retention defaults for approval/event metadata.
4. ~~Decide where subscription management lives; default recommendation is web-owned billing with app-consumed entitlements.~~ Decision captured: web-owned billing (Stripe) with app-consumed entitlements. See §3.1.
5. Model idle WebSocket connection cost before promising always-on relay.
6. Model node-per-user/workspace relay costs separately from shared relay costs.
7. Keep transcript/content sync out of scope until the encryption and pricing model are explicit.
8. Build web billing portal (Stripe) for Pro/Team subscriptions before Play Store launch.
9. Host Privacy Policy at a public URL (draft at `docs/PRIVACY_POLICY.md`).
10. Complete Google Play Store listing: Data Safety form, content rating, store listing assets.
11. Implement E2E envelope encryption for relay-mode payloads (architecture in `docs/ARCHITECTURE.md` §5) before launching hosted relay as a paid feature.
