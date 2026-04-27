# ClawFace Agent-Side Component Architecture

Status: Draft
Created: 2026-04-27

This is the canonical agent-side component architecture for the agent runtime that pairs with ClawFace. The stable boundary between the mobile app and any agent runtime is the WebSocket wire protocol in `docs/PROTOCOL.md`. Everything behind that boundary may evolve without changing the ClawFace mobile client.

Product architecture, hosted/local responsibility, trust boundaries, and approval-safety requirements live in `docs/ARCHITECTURE.md`. This document only defines agent-side component boundaries and substitutable interfaces.

---

## 1. Design principles

- Keep ClawFace coupled only to the wire protocol, not to a specific harness, model provider, browser engine, or tool framework.
- Treat every agent-side boundary as an interface so implementations can be swapped independently.
- Prefer existing open-source primitives over bespoke framework code.
- Keep model-provider selection compatible with pi.dev-style provider abstraction rather than hardcoding one model vendor.
- Route tools through an MCP-compatible layer so adding or removing tools does not require harness changes.

---

## 2. Component map

```text
ClawFace mobile
    |  WebSocket (docs/PROTOCOL.md - stable boundary)
    v
[HarnessAdapter] <-> [ModelProvider]
    |                    (Anthropic / OpenAI / Google / Ollama / pi-compatible provider)
    |
    +-> [McpServer] <-> [ToolProvider implementations]
    |                         +- [BrowserTool]
    |                         |     (Lightpanda / Playwright / mock)
    |                         +- [File system tool]
    |                         +- [Shell tool]
    |                         +- [User-supplied tools]
    |
    +-> [Session / pairing / approval routing]
```

The harness owns ClawFace protocol compliance. Model, tool, browser, and MCP components should not know that ClawFace exists.

---

## 3. Boundary contracts

### 3.1 `HarnessAdapter`

Location: `agent/interfaces/harness.ts`

Responsibilities:

- expose `/pair` and `/agent` according to `docs/PROTOCOL.md`
- validate pairing codes and session keys
- translate ClawFace user messages into model turns
- translate model/tool output into ClawFace thread/message/approval events
- route approval decisions back to the pending tool call
- delegate model execution to `ModelProvider`
- delegate tool discovery/execution to `McpServer`

Non-responsibilities:

- direct model-vendor SDK calls
- direct browser automation calls
- direct tool implementation logic

Candidate implementations:

- pi.dev RPC/stdin-stdout mode as the backing harness process
- a custom Node.js WebSocket harness
- an OpenClaw plugin that implements the ClawFace protocol

### 3.2 `ModelProvider`

Location: `agent/interfaces/model.ts`

Responsibilities:

- accept conversation messages and available tool specs
- stream completion chunks
- surface model-requested tool calls in a provider-neutral format
- expose provider/model identity for diagnostics

Compatibility note:

- pi.dev already handles switching across many providers. The ClawFace-side `ModelProvider` shape should stay compatible with that style: a provider is selected by configuration and yields a stream of text/tool-call chunks without leaking provider SDK details to the harness.

Candidate implementations:

- pi.dev provider abstraction
- Anthropic SDK adapter
- OpenAI-compatible adapter, including Ollama via base URL
- Google/Gemini adapter
- local mock provider for tests

### 3.3 `ToolProvider`

Location: `agent/interfaces/tool.ts`

Responsibilities:

- describe available tools as `ToolSpec` values
- execute named tools with JSON-like arguments
- return structured results, logs, and error state in a harness-neutral format

Non-responsibilities:

- model prompting
- ClawFace WebSocket message formatting
- approval UI policy

Candidate implementations:

- file system tools
- shell tools
- browser tools
- user-supplied custom tools
- MCP-backed tools

### 3.4 `BrowserTool`

Location: `agent/interfaces/browser.ts`

Responsibilities:

- provide browser automation behind the generic `ToolProvider` boundary
- navigate, extract content, click, type, and capture screenshots
- expose a page snapshot that is useful to model/tool callers without requiring direct browser-engine coupling

Candidate implementations:

- Lightpanda for low-resource CDP-compatible browsing; the default implementation in `agent/tools/browser-lightpanda.ts` talks to a Lightpanda CDP endpoint and implements the generic `ToolProvider` tool names
- Playwright for broad compatibility; it should satisfy the same `BrowserTool` interface without changing harness code
- mock browser for tests and deterministic fixtures; `agent/tools/browser-mock.ts` provides static HTML snapshots and deterministic screenshot bytes

Swapping Lightpanda for Playwright or the mock browser should be a harness configuration/import choice only. The harness should depend on `BrowserTool`, not on browser-engine-specific APIs.

### 3.5 `McpServer`

Location: `agent/interfaces/mcp.ts`

Responsibilities:

- list registered tools
- call tools by name
- register tool handlers at startup
- act as the single tool-discovery boundary consumed by `HarnessAdapter` and `ModelProvider`

Candidate implementations:

- official/modelcontextprotocol TypeScript SDK wrapper
- lightweight in-process MCP-compatible registry for local development
- external MCP server bridge

---

## 4. Interface stub map

Each interface stub in `agent/interfaces/` maps to a boundary above:

- `harness.ts` -> `HarnessAdapter`
- `model.ts` -> `ModelProvider`
- `tool.ts` -> `ToolProvider` plus shared tool/result types
- `browser.ts` -> `BrowserTool`
- `mcp.ts` -> `McpServer`

These files are intentionally separate from the Expo app source. They define an agent-side contract only; mobile app runtime code should not import from `agent/`.

---

## 5. Future implementation notes

- CF-011 implements `BrowserTool` using Lightpanda and a mock, while preserving Playwright as a drop-in alternative.
- CF-012 should add real provider adapters without changing `HarnessAdapter`.
- CF-013 should add the concrete MCP server/registry and route all tool calls through it.
- Approval request IDs, expiry, and revocation must continue to follow `docs/PROTOCOL.md` and `docs/ARCHITECTURE.md`.
