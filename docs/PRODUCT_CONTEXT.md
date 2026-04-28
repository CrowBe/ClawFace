# ClawFace Product Context

Status: Draft
Created: 2026-04-28

This is the canonical product-context document for ClawFace. Use it to evaluate product, design, architecture, and feature decisions against a coherent product vision.

Related documents:

- `docs/UBIQUITOUS_LANGUAGE.md` — canonical product/domain vocabulary
- `docs/ARCHITECTURE.md` — technical/product architecture, trust boundaries, relay responsibilities, and hosted/local responsibilities
- `docs/BACKLOG.md` — executable work backlog; not a source of product truth
- `docs/PROTOCOL.md` — wire protocol (the only stable contract between ClawFace and any paired agent runtime)
- `docs/SCALING_AND_UNIT_ECONOMICS.md` — business model and scaling assumptions

---

## Product framing

ClawFace is an **AI agent operations app**: a mobile command surface for supervising, messaging, and safely directing work across trusted AI agents and workstreams.

It is intended to feel like the modern "coalface" for AI-powered work: the place a person goes to coordinate, direct, and keep broad work moving across multiple agentic efforts.

The product is not primarily a developer tool, even though coding agents are the current beachhead. It should not become an alternative UI for Codex, Claude Code, or any specific development agent. Coding work is an early use case because it already exposes long-running agent work, context separation, remote execution, and occasional handoff needs.

---

## Product thesis

As AI agents become more capable and accessible outside purely technical roles, people will need a simple command surface for coordinating multiple agents across multiple workstreams without collapsing everything into one overloaded chat.

ClawFace exists to preserve context, keep users in command, and lower the barrier for less technical users to coordinate trusted AI agents.

The product should let users take control of a wider scope of AI-powered work without feeling like they are babysitting a notification firehose.

---

## Target audience

The primary user is an **Agent Operator**: a person who delegates work to trusted AI agents and needs a simple mobile way to coordinate that work.

Agent Operators may be:

- technical users supervising coding agents
- solo operators coordinating personal-assistant-style agents
- sales, operations, support, or CRM users coordinating domain-specific agents
- future team users coordinating several agents and human collaborators across workstreams

The target audience is not limited to developers. Developer-focused work is a first wedge, not the product identity.

---

## Core job-to-be-done

When I am driving a broad scope of AI-powered work, I want to coordinate multiple agents and workstreams from one mobile surface without losing context or collapsing separate efforts into one conversation.

Short form:

> Coordinate many AI workstreams from mobile without context collapse.

---

## Core product promises

### 1. Preserve context

Separate workstreams stay separate, so users can coordinate broad AI-powered work without context collapse.

### 2. Keep users in command

Users can see what work is happening, where it belongs, and how to respond.

### 3. Lower the barrier

Non-technical and less technical users can coordinate trusted AI agents without understanding agent internals.

---

## Experience north star

ClawFace should create **momentum and control without panic**.

The product should feel calm, clear, and empowering:

- users know where each piece of work lives
- users can step into the right workstream without derailing another context
- users can coordinate multiple agents without needing the full underlying tool open
- notifications and handoffs are selective and meaningful
- the UI avoids urgency theatre, red-dot anxiety, and alert fatigue

ClawFace should not feel like PagerDuty for agents, a Slack clone, or an IDE squeezed onto a phone.

---

## Product boundaries

ClawFace is a command surface, not the agent runtime or policy brain.

It should stay light on configuration and should only surface controls directly related to pairing, identifying, messaging, monitoring, and directing agents from the command surface.

Agent permission models, deep tool policy, runtime configuration, and organisational access controls belong to the underlying agent platform or workspace tooling.

Approvals and handoffs matter only when connected agents produce meaningful user-facing decisions. ClawFace may surface approval or handoff requests from an agent runtime, but it should not invent or own the runtime's approval policy.

---

## Non-goals

1. **Not an agent runtime** — ClawFace does not execute agents or own their internal work loops.
2. **Not a model/tool configuration system** — agent permissions, tool policy, and deep runtime setup belong to the agent platform.
3. **Not a developer IDE or Codex alternative** — coding agents are an early use case, not the product category.
4. **Not a generic chat app** — conversation exists to coordinate workstreams, not to replace Slack, Telegram, or team chat.
5. **Not a notification firehose** — ClawFace should create calm command, not urgency or alert fatigue.

---

## Product model

The product model centers on **Workstreams**.

A Workstream is a bounded unit of ongoing work with its own context, agent activity, messages, updates, and handoffs. Workstreams prevent context collapse by keeping separate efforts separate.

A Workstream can contain many Threads. A Thread is a focused conversation or activity lane inside a Workstream. In the first implementation, a Thread is usually connected to one Agent. The domain model should allow multiple participants later, including multiple agents and humans, without requiring that complexity now.

Shared Workstream Context can later help multiple Threads and Agents stay aligned without merging their conversations.

```text
Workstream
  ├─ Workstream Context
  └─ Threads
       └─ Participants
            ├─ User / Human
            └─ Agent(s)
```

Implementation can remain simpler than the product model while the first wedge is proven.

---

## First real product milestone

The first real milestone should prove:

> A user can pair one trusted AI agent, keep workstreams distinct, and message or monitor work in the right context.

For the current coding-agent beachhead, this maps to:

- pair a local OpenClaw-backed agent
- display enough context for the user to understand where work belongs
- keep threads/workstreams scoped
- send and receive messages without context collapse

Approvals are not essential to this milestone. They become more valuable when integrations expose meaningful user-facing handoffs, such as future coworker-style agents.
