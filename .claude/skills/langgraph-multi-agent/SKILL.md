---
name: langgraph-multi-agent
description: >
  Expert-level guidance for designing, building, and debugging multi-agent systems
  using LangChain.js and LangGraph.js. Covers architecture philosophy (supervisor,
  swarm, custom graph), StateGraph API, Annotation/reducers, streaming (SSE, streamEvents),
  tool calling (ToolNode, bindTools, DynamicStructuredTool), checkpointing/memory,
  prebuilt agents (createReactAgent, createSupervisor, createSwarm), error handling,
  and production hardening. Use when the user mentions: multi-agent, LangChain,
  LangGraph, agent orchestration, supervisor pattern, swarm agents, agent handoff,
  StateGraph, ToolNode, createReactAgent, agent streaming, agent checkpointing,
  agent memory, agentic workflows, agent loops, or any LangChain/LangGraph library usage.
---

# LangGraph Multi-Agent Expert

Deep expertise in multi-agent system design and implementation with LangChain.js / LangGraph.js.

## Decision Tree

Determine what the user needs:

**Designing a multi-agent system?** Read [references/multi-agent-architecture.md](references/multi-agent-architecture.md) for pattern selection guidance, philosophy, and trade-offs.

**Implementing with LangGraph.js?** Read [references/langgraph-patterns.md](references/langgraph-patterns.md) for API reference, code patterns, and examples covering StateGraph, tools, streaming, checkpointing, and prebuilt agents.

**Debugging or hitting errors?** Read [references/langgraph-pitfalls.md](references/langgraph-pitfalls.md) for common pitfalls, error patterns, and debugging strategies.

**Building something end-to-end?** Read all three references as needed throughout the process.

## Core Principles

1. **Keep LangChain imports server-only.** `@langchain/*` packages use `node:async_hooks` which breaks webpack/client bundling. Share types via a separate file with zero LangChain imports.

2. **Always define reducers for shared state keys.** Without a reducer, concurrent node updates silently overwrite each other. Use `MessagesAnnotation` for messages.

3. **Enable `handleToolErrors: true` on ToolNode.** Without it, invalid LLM tool calls crash the workflow instead of retrying.

4. **Type-check messages before casting.** Never blindly cast `state.messages[last]` as `AIMessage` -- check `._getType()` first.

5. **Set explicit recursion limits and iteration counters.** Prevent infinite loops in cyclic agent graphs.

6. **Wrap SSE writer calls in try-catch.** Clients can disconnect mid-stream.

## Quick Reference: Key Imports

```typescript
// Graph
import { StateGraph, Annotation, MessagesAnnotation, START, END, Command, Send, MemorySaver } from "@langchain/langgraph";
// Prebuilt
import { createReactAgent, ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
// Multi-agent
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";
// Messages
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
// Tools
import { tool } from "@langchain/core/tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
// Model
import { ChatAnthropic } from "@langchain/anthropic";
```

## Minimal Patterns

### Define State

```typescript
const MyState = Annotation.Root({
  ...MessagesAnnotation.spec,
  customField: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});
```

### Build Graph

```typescript
const graph = new StateGraph(MyState)
  .addNode("agent", agentFn)
  .addNode("tools", new ToolNode(tools, { handleToolErrors: true }))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", toolsCondition)
  .addEdge("tools", "agent")
  .compile({ recursionLimit: 50 });
```

### Define Tool

```typescript
const myTool = tool(
  async ({ input }) => `Result: ${input}`,
  { name: "my_tool", description: "Does X", schema: z.object({ input: z.string() }) }
);
const modelWithTools = model.bindTools([myTool]);
```
