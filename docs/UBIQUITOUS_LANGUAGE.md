# Ubiquitous Language

Status: Draft
Created: 2026-04-28

This document defines ClawFace's product/domain language. Use these terms in product docs, design discussions, backlog items, and user-facing copy unless there is a deliberate reason not to.

## Product category and actors

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **ClawFace** | An AI agent operations app that provides a mobile command surface for coordinating trusted AI agents and workstreams. | Mobile IDE, Codex UI, agent runtime, chat app |
| **AI agent operations app** | A product category for tools that help people coordinate AI agents, workstreams, updates, and handoffs. | Agentic operations, agent management, automation dashboard |
| **Mobile command surface** | A lightweight mobile interface for monitoring, messaging, and directing AI-powered work. | Remote desktop, mobile IDE, notification center |
| **Agent Operator** | A person coordinating AI-powered work through one or more trusted AI agents. | Developer, admin, user, manager |
| **Trusted Agent** | An AI agent intentionally paired with ClawFace so an Agent Operator can monitor, message, and direct it. | Workspace, runtime, bot, integration |

## Work coordination

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Workstream** | A bounded unit of ongoing work with its own context, agent activity, messages, updates, and handoffs. | Chat, task, project, thread, session |
| **Thread** | A focused conversation or activity lane inside a Workstream. | Workstream, chat room, session |
| **Participant** | A human or agent involved in a Thread. | User, member, bot |
| **Workstream Context** | Shared context available across Threads and Participants within a Workstream. | Memory, global context, transcript dump |
| **Handoff** | A request from an agent for human input, direction, or decision inside a Workstream. | Alert, interruption, approval |
| **Update** | Information emitted by an agent about progress or state in a Workstream. | Notification, log, event |

## Context and boundaries

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Agent Context** | Metadata describing where or within what scope a Trusted Agent is acting, such as a repo, CRM, inbox, project, or cloud workspace. | Workspace, environment, repo |
| **Pairing** | The intentional act of connecting a Trusted Agent to ClawFace. | Login, install, sync |
| **Context collapse** | The loss of clarity caused by mixing separate work efforts into one conversation or activity stream. | Topic switching, chat clutter |
| **Approval** | A runtime-supplied request to approve or deny a consequential action. | Permission, policy, configuration |
| **Agent runtime** | The external system that executes an agent and owns its internal work loop, permissions, and tool policy. | ClawFace, workspace, command surface |

## Relationships

- An **Agent Operator** uses **ClawFace** to coordinate one or more **Trusted Agents**.
- A **Trusted Agent** is connected to ClawFace through **Pairing**.
- A **Trusted Agent** may expose **Agent Context** so the operator understands where work is happening.
- A **Workstream** contains one or more **Threads**.
- A **Thread** belongs to one **Workstream**.
- A **Thread** has one or more **Participants** over the long-term product model.
- In the first implementation, a **Thread** is usually connected to one **Trusted Agent**.
- **Workstream Context** can inform multiple **Threads** without merging their conversations.
- **Updates**, **Handoffs**, and **Approvals** occur within a **Workstream** or **Thread**.
- The **Agent runtime** owns execution, permission policy, and deep tool configuration; **ClawFace** owns the mobile command surface.

## Example dialogue

> **Dev:** "Should the ClawFace home screen show repositories first?"
>
> **Domain expert:** "No. A repository is just **Agent Context** for coding agents. The product should center **Workstreams**, because ClawFace is not only for developers."
>
> **Dev:** "So a coding task like `Implement local bridge` is a **Workstream**, and the repo/branch are context attached to it?"
>
> **Domain expert:** "Exactly. The **Trusted Agent** may expose repo and branch as **Agent Context**, but the operator is coordinating the **Workstream**."
>
> **Dev:** "And if later we have a sales CRM agent and a research agent contributing to the same effort, they could be **Participants** in separate **Threads** under one **Workstream**?"
>
> **Domain expert:** "Yes. Keep the conversations separate to avoid **context collapse**, but let shared **Workstream Context** connect the effort."

## Flagged ambiguities

- **Workspace** is overloaded. OpenClaw and other tools already use it to mean an execution or project environment. In ClawFace product language, prefer **Workstream** for the unit of coordinated work and **Agent Context** for where an agent is acting. Note: `docs/ARCHITECTURE.md` and `docs/SCALING_AND_UNIT_ECONOMICS.md` use "workspace" specifically as an **infrastructure tenancy** term (per-account/per-relay-node, per-seat-or-workspace pricing). That infra usage is intentional and distinct from the product-domain Workstream defined here \u2014 the infra-workspace is a billing/relay-node scope, not a unit of coordinated work.
- **Agent** is ambiguous outside AI because it may mean a sales or support representative. In product/category language, use **AI agent** or **Trusted Agent** when clarity matters.
- **Thread** and **Workstream** must stay distinct. A **Thread** is a conversation or activity lane; a **Workstream** is the broader bounded effort.
- **Approval** should not imply ClawFace owns permission policy. Approvals are surfaced from the **Agent runtime** when useful.
- **Developer** is too narrow for the target audience. Coding agents are the current beachhead, but the canonical actor is **Agent Operator**.
