---
name: langgraph
description: Expert-level guidance for designing, building, and debugging multi-agent systems using LangChain.js and LangGraph.js. Covers architecture philosophy (supervisor, swarm, custom graph, functional API), StateGraph API, Annotation/StateSchema/reducers, streaming (SSE, multiple modes, custom writer), tool calling (ToolNode, bindTools, tool()), checkpointing/memory, prebuilt agents (createAgent, createReactAgent, createSupervisor, createSwarm), human-in-the-loop (interrupt/Command), subgraphs, error handling, and production hardening. Use when the user mentions: multi-agent, multi agent, LangChain, LangGraph, agent orchestration, supervisor pattern, swarm agents, agent handoff, StateGraph, ToolNode, createReactAgent, createAgent, agent streaming, agent checkpointing, agent memory, agentic workflows, agent loops, functional API, entrypoint, interrupt, human-in-the-loop, or any LangChain/LangGraph library usage.
---

# LangGraph Multi-Agent Expert

Deep expertise in multi-agent system design and implementation with LangChain.js / LangGraph.js.

## What's Current (LangGraph v1 + LangChain v1)

Key changes to be aware of:

- **`createAgent`** from `"langchain"` replaces `createReactAgent` from `@langchain/langgraph/prebuilt`. Uses `systemPrompt` (not `prompt`), supports middleware (HITL, summarization, PII redaction).
- **`StateSchema`** with Zod is the recommended way to define state (alternative to `Annotation.Root`). Uses `ReducedValue`, `MessagesValue`.
- **Functional API** (`entrypoint`, `task` from `@langchain/langgraph/func`) — imperative alternative to StateGraph for linear workflows.
- **`interrupt()`** function for human-in-the-loop — pause graph, resume with `Command({ resume: ... })`.
- **Custom streaming** via `config.writer?.()` with `streamMode: "custom"`. Multiple modes: `streamMode: ["messages", "updates", "custom"]`.
- Core Graph API (StateGraph, nodes, edges, `Annotation.Root`) is **unchanged and stable**.

## Decision Tree

Determine what the user needs:

**Quick start / single agent with tools?**
- Use `createAgent` from `"langchain"` (v1) or `createReactAgent` from `@langchain/langgraph/prebuilt` (legacy)
- See [Example 1](#example-1-single-agent-with-tools) below

**Designing a multi-agent architecture?**
- Choosing between supervisor, swarm, custom graph, or functional API
- Read [references/multi-agent-architecture.md](references/multi-agent-architecture.md)

**Fixed pipeline (Design -> Engineer -> QA)?**
- Use custom StateGraph with explicit edges
- See [Example 2](#example-2-multi-agent-pipeline) below

**Dynamic routing (LLM decides which agent)?**
- Use `createSupervisor` from `@langchain/langgraph-supervisor`
- See [Example 3](#example-3-supervisor-with-prebuilt) below

**Peer-to-peer agent handoff?**
- Use `createSwarm` / `createHandoffTool` from `@langchain/langgraph-swarm`
- Read [references/multi-agent-architecture.md](references/multi-agent-architecture.md) Pattern 3

**Linear multi-step workflow (no graph needed)?**
- Use Functional API: `entrypoint` + `task` from `@langchain/langgraph/func`
- Read [references/langgraph-patterns.md](references/langgraph-patterns.md) Functional API section or [references/multi-agent-architecture.md](references/multi-agent-architecture.md) Pattern 4

**Need human approval before tool execution?**
- Use `humanInTheLoopMiddleware` with `createAgent`, or `interrupt()` in graph nodes
- Read [references/langgraph-patterns.md](references/langgraph-patterns.md) Human-in-the-Loop section

**Implementing streaming to a client?**
- Use `graph.stream()` with `streamMode` (not `streamEvents`)
- Combined modes: `streamMode: ["messages", "updates", "custom"]`
- Read [references/langgraph-patterns.md](references/langgraph-patterns.md) Streaming section

**Defining graph state?**
- `StateSchema` (v1, Zod-based) or `Annotation.Root` (stable) — both valid
- Read [references/langgraph-patterns.md](references/langgraph-patterns.md) StateGraph and Annotation / StateSchema sections

**Using subgraphs (graph-as-node)?**
- Invoke from a node function, or add compiled graph directly as a node
- Read [references/multi-agent-architecture.md](references/multi-agent-architecture.md) Subgraphs section

**Debugging or hitting errors?**
- Read [references/langgraph-pitfalls.md](references/langgraph-pitfalls.md) for common pitfalls and fixes

**Migrating from pre-v1 code?**
- `createReactAgent` -> `createAgent`, `prompt` -> `systemPrompt`
- Read [references/langgraph-pitfalls.md](references/langgraph-pitfalls.md) Version Migration section

**Building something end-to-end?**
- Read all three references as needed throughout the process

## Core Principles

1. **Keep LangChain imports server-only.** `@langchain/*` packages use `node:async_hooks` which breaks webpack/client bundling. Share types via a separate file with zero LangChain imports.

2. **Always define reducers for shared state keys.** Without a reducer, concurrent node updates cause `InvalidUpdateError`. Use `MessagesAnnotation` or `MessagesValue` for messages.

3. **Enable `handleToolErrors: true` on ToolNode.** Without it, invalid LLM tool calls crash the workflow instead of retrying.

4. **Type-check messages before casting.** Never blindly cast `state.messages[last]` as `AIMessage` -- check `._getType()` first.

5. **Set explicit recursion limits and iteration counters.** Prevent infinite loops in cyclic agent graphs.

6. **Wrap SSE writer calls in try-catch.** Clients can disconnect mid-stream.

7. **Use `tool()` over `DynamicStructuredTool`.** Simpler API, fewer TS type-depth issues. Tool functions must return strings.

8. **Interrupts require a checkpointer.** `interrupt()` won't work without persistence. Also not available in `@langchain/langgraph/web`.

## Quick Reference: Key Imports

```typescript
// Graph API
import { StateGraph, Annotation, MessagesAnnotation, START, END, Command, Send, MemorySaver } from "@langchain/langgraph";
// State (v1 alternative)
import { StateSchema, ReducedValue, MessagesValue } from "@langchain/langgraph";
// Functional API
import { entrypoint, task } from "@langchain/langgraph/func";
// Prebuilt (legacy)
import { createReactAgent, ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
// Prebuilt (v1 — preferred)
import { createAgent, humanInTheLoopMiddleware } from "langchain";
// Multi-agent
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";
// Interrupts
import { interrupt } from "@langchain/langgraph";
// Messages
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
// Tools
import { tool } from "@langchain/core/tools";
// Model
import { ChatAnthropic } from "@langchain/anthropic";
// Config type (for streaming writer)
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
```

## Minimal Examples

### Example 1: Single Agent with Tools

```typescript
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool = tool(
  async ({ query }) => `Results for: ${query}`,
  { name: "search", description: "Search the web", schema: z.object({ query: z.string() }) }
);

const agent = createAgent({
  model: "claude-haiku-4-5",
  tools: [searchTool],
  systemPrompt: "You are a helpful assistant with search capabilities.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is LangGraph?" }],
});
```

**Legacy equivalent** (still works, `createReactAgent`):
```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";

const agent = createReactAgent({
  llm: new ChatAnthropic({ model: "claude-haiku-4-5" }),
  tools: [searchTool],
  prompt: "You are a helpful assistant.",
});
```

### Example 2: Multi-Agent Pipeline

```typescript
import { StateGraph, Annotation, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage } from "@langchain/core/messages";
import type { AIMessage } from "@langchain/core/messages";

const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentPhase: Annotation<string>({ reducer: (_, b) => b, default: () => "design" }),
  iterationCount: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
});

const model = new ChatAnthropic({ model: "claude-haiku-4-5" });

async function designNode(state: typeof State.State) {
  const response = await model.bindTools([designTool]).invoke([
    new SystemMessage("You are a UI designer. Create a component spec."),
    ...state.messages,
  ]);
  return { messages: [response], currentPhase: "design" };
}

async function engineerNode(state: typeof State.State) {
  const response = await model.bindTools([strReplaceTool]).invoke([
    new SystemMessage("You are a React engineer. Implement the spec."),
    ...state.messages,
  ]);
  return { messages: [response], currentPhase: "engineer" };
}

function routeDesign(state: typeof State.State) {
  const last = state.messages[state.messages.length - 1];
  if (last._getType() === "ai" && (last as AIMessage).tool_calls?.length) {
    return "design_tools";
  }
  return "engineer";
}

const graph = new StateGraph(State)
  .addNode("design", designNode)
  .addNode("design_tools", new ToolNode([designTool], { handleToolErrors: true }))
  .addNode("engineer", engineerNode)
  .addNode("engineer_tools", new ToolNode([strReplaceTool], { handleToolErrors: true }))
  .addEdge(START, "design")
  .addConditionalEdges("design", routeDesign, { design_tools: "design_tools", engineer: "engineer" })
  .addEdge("design_tools", "design")
  .addConditionalEdges("engineer", toolsCondition)
  .addEdge("tools", "engineer")
  .compile({ recursionLimit: 50 });
```

### Example 3: Supervisor with Prebuilt

```typescript
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({ model: "claude-haiku-4-5" });

const designer = createReactAgent({
  llm: model,
  tools: [designTool],
  name: "designer",
  prompt: "You are a UI/UX design expert.",
});

const engineer = createReactAgent({
  llm: model,
  tools: [strReplaceTool, fileManagerTool],
  name: "engineer",
  prompt: "You are a React engineer.",
});

const supervisor = createSupervisor({
  agents: [designer, engineer],
  llm: model,
  prompt: "Route design tasks to designer, implementation to engineer.",
});

// createSupervisor returns a StateGraph -- MUST compile
const app = supervisor.compile();
const result = await app.invoke({
  messages: [{ role: "user", content: "Build a todo app" }],
});
```
