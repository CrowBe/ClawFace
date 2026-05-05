# Google Play Store Listing Draft

This draft supports CF-028 Google Play Store preparation. It is store copy, not a product or architecture source of truth.

## App name

ClawFace

## Short description

Coordinate trusted AI agents and workstreams from your phone.

## Full description

ClawFace is a mobile command surface for AI agent operations. Pair trusted AI agents, keep workstreams separate, and stay in control of active work from your phone.

Built for Agent Operators, ClawFace helps you coordinate AI-powered work without collapsing everything into one overloaded chat. Coding agents are the first supported wedge, with OpenClaw Gateway pairing for local and self-hosted workflows.

What ClawFace helps you do:

- Pair a trusted AI agent intentionally
- Keep workstreams and threads scoped to the right context
- See Agent Context, such as where a paired agent is acting
- Send messages into the right thread while away from your main machine
- Unpair and revoke stored credentials when access should end

ClawFace is local-first by default. Session credentials and device identity keys are stored in platform-secure storage, and the app is designed to avoid sending prompts, code, logs, or secrets through third-party infrastructure for local direct use.

ClawFace is not an agent runtime, model provider, IDE, or generic chat app. It is the calm mobile surface for coordinating trusted agents and keeping separate workstreams clear.

## Store listing notes

- Category candidate: Productivity.
- Content tone: calm command, not urgency/firehose.
- Avoid positioning as a Codex, Claude Code, or IDE replacement.
- Avoid promising hosted relay, push, team, or approval features until shipped.

## Reviewer app access notes

ClawFace currently requires a local or self-hosted OpenClaw Gateway to exercise the main pairing and messaging flow.

Suggested reviewer note:

> ClawFace pairs with an OpenClaw Gateway using a local/self-hosted connection. To test the app, run OpenClaw Gateway locally, generate a pairing credential, then paste or scan the pairing payload in ClawFace. No hosted account is required for the local-first flow.
