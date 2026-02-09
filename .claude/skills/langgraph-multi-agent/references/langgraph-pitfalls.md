# LangGraph.js Pitfalls and Debugging

## Table of Contents

- [Bundling and Environment](#bundling-and-environment)
- [State Management](#state-management)
- [Streaming and SSE](#streaming-and-sse)
- [Tool Calling](#tool-calling)
- [Memory and Checkpointing](#memory-and-checkpointing)
- [Graph Structure](#graph-structure)
- [TypeScript Issues](#typescript-issues)
- [Debugging Strategies](#debugging-strategies)
- [Error Handling Best Practices](#error-handling-best-practices)

---

## Bundling and Environment

### `node:async_hooks` Breaks Client Components

**Symptom:** `UnhandledSchemeError: Reading from "node:async_hooks" is not handled by plugins`

**Cause:** All `@langchain/*` packages use `node:async_hooks`. Importing them in `"use client"` components breaks webpack.

**Fix:**
- Keep all LangChain/LangGraph imports in server-only files (API routes, server actions)
- Use dynamic imports (`await import(...)`) for lazy server-side loading
- Share types via a separate file with zero LangChain imports:
  ```typescript
  // src/lib/agents/types.ts -- NO LangChain imports
  export interface AgentStreamEvent {
    type: "agent_start" | "agent_message" | "agent_done";
    agent: string;
    content?: string;
  }
  ```
- For browser environments, import from `@langchain/langgraph/web` (limited: no `interrupt()`, no functional API)

### Edge Runtime Incompatible

**Symptom:** `fs` module or `async_hooks` errors in Vercel Edge Functions.

**Fix:** Use `export const runtime = "nodejs"` in API routes. Never use `"edge"` runtime with LangGraph.

### Granular Imports Required

Always use specific import paths:
```typescript
// Good
import { ChatAnthropic } from "@langchain/anthropic";
// Bad -- may pull Node.js-only modules into client bundles
import { ChatAnthropic } from "langchain/chat_models";
```

---

## State Management

### Missing Reducers Cause Silent Overwrites

**Symptom:** State updates from one node disappear after another node runs.

**Cause:** No reducer defined for a key that multiple nodes update.

**Fix:** Always define reducers for shared keys:
```typescript
// BAD
const State = Annotation.Root({ count: Annotation<number> });

// GOOD
const State = Annotation.Root({
  count: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});
```

### Duplicate Messages

**Symptom:** Messages array contains duplicates after multiple iterations.

**Cause:** Using a naive concat reducer `(a, b) => [...a, ...b]` instead of `messagesStateReducer`.

**Fix:** Use `MessagesAnnotation` which includes ID-based deduplication. Ensure all messages have unique IDs.

### Checkpoint Serialization Strips Message IDs

**Symptom:** After loading from checkpoint, messages lose their IDs, causing duplicates on next update.

**Fix:** Verify checkpointer roundtrip serialization preserves all message fields. Test with: `getState() → update → getState()` and compare IDs.

### Direct State Mutation

**Symptom:** State changes are not reflected in downstream nodes.

**Cause:** Mutating `state` directly instead of returning new values.

**Fix:** Always return a new partial state object:
```typescript
// BAD
function myNode(state) { state.count += 1; return state; }

// GOOD
function myNode(state) { return { count: state.count + 1 }; }
```

---

## Streaming and SSE

### SSE Connection Limit (6 per domain)

**Symptom:** New SSE connections queue or fail when multiple tabs/streams are open.

**Cause:** HTTP/1.1 limits to 6 concurrent connections per domain.

**Fix:** Use HTTP/2 in production. Share a single SSE connection and multiplex by ID. Close connections promptly.

### `streamEvents` Inconsistencies with ChatAnthropic

**Symptom:** `on_chain_end` event returns malformed data (dict with `messages` key that isn't an array).

**Fix:** Use `graph.stream()` with `streamMode` parameter instead of `streamEvents`. Or add defensive parsing:
```typescript
if (Array.isArray(event.data?.messages)) { /* safe */ }
```

### Writer Already Closed

**Symptom:** `TypeError: Cannot write to a closed WritableStream`

**Cause:** Client disconnected mid-stream.

**Fix:** Wrap all writes in try-catch, close writer in `finally`:
```typescript
try { await writer.write(data); } catch { /* client gone */ }
// ...
finally { try { await writer.close(); } catch {} }
```

### Backpressure / Memory Leaks

**Symptom:** Server memory grows during long workflows.

**Fix:** Set `highWaterMark` on `TransformStream`. Implement heartbeat to detect dead connections.

---

## Tool Calling

### LLM Hallucinates Tool Names or Invalid Args

**Symptom:** `ToolNode` throws validation error, crashing the workflow.

**Fix:** Enable error handling:
```typescript
const toolNode = new ToolNode(tools, { handleToolErrors: true });
```
This sends errors back to the LLM as `ToolMessage` so it can retry.

### Tool Functions Must Return Strings

**Symptom:** `ToolMessage` content is `[object Object]` or undefined.

**Fix:** Always return a string from tool functions. Use `JSON.stringify()` for complex objects.

### `bindTools` Returns a New Instance

**Symptom:** Model doesn't know about tools, never makes tool calls.

**Cause:** Using the original model instead of the return value of `bindTools`.

**Fix:**
```typescript
const modelWithTools = model.bindTools(tools);  // use modelWithTools, not model
```

---

## Memory and Checkpointing

### MemorySaver Is Not Persistent

**Symptom:** Conversation history lost after server restart.

**Cause:** `MemorySaver` stores state in memory only.

**Fix:** Use database-backed checkpointer for production (PostgreSQL, SQLite).

### Missing `thread_id`

**Symptom:** `thread_id is required when using a checkpointer`

**Fix:** Always include in config:
```typescript
await graph.invoke(input, { configurable: { thread_id: "unique-id" } });
```

### Human-in-the-Loop Resume Failures

**Symptom:** After `interrupt()`, resuming restarts graph from beginning instead of continuing.

**Fix:** Use the same `thread_id` for both initial invocation and resume. Verify checkpointer persists correctly. Note: `interrupt()` is not available in web/browser environments.

---

## Graph Structure

### Infinite Loops

**Symptom:** `GraphRecursionError` after hitting the recursion limit.

**Cause:** Cyclic edges without termination conditions.

**Fix:**
- Set explicit `recursionLimit` in `.compile()`
- Add iteration counters to state
- Check counters in routing functions:
```typescript
function routeQA(state) {
  if (state.iterationCount >= MAX_ITERATIONS) return END;
  if (needsRevision) return "engineer";
  return END;
}
```

### Unsafe AIMessage Casting

**Symptom:** `undefined` when accessing `.tool_calls` on a non-AI message.

**Cause:** Casting last message as `AIMessage` without type checking.

**Fix:**
```typescript
const lastMsg = state.messages[state.messages.length - 1];
if (lastMsg._getType() === "ai" && (lastMsg as AIMessage).tool_calls?.length) {
  return "tools";
}
```

### Growing Message Array Hits Token Limits

**Symptom:** LLM errors with "max tokens exceeded" after several agent iterations.

**Cause:** Each agent invocation prepends SystemMessage + all accumulated messages.

**Fix:**
- Summarize or truncate older messages before passing to LLM
- Pass only relevant recent messages + system prompt
- Track token count and trim when approaching limits

### Parallel Node State Conflicts

**Symptom:** Updates from parallel nodes (fan-out) are silently dropped.

**Cause:** No reducer defined for keys updated by parallel nodes.

**Fix:** Define merge reducers for all keys that receive parallel updates.

---

## TypeScript Issues

### TS2589: Excessive Type Depth

**Symptom:** `Type instantiation is excessively deep and possibly infinite`

**Cause:** Complex Zod schemas with `DynamicStructuredTool`. Exacerbated by Zod >= 3.25.68.

**Fix:**
- Use `@ts-expect-error` to suppress
- Pin Zod to `<= 3.25.67`
- Break complex schemas into smaller sub-schemas
- Add explicit type annotations

### Cannot Export Graphs with Zod State Schemas

**Symptom:** TypeScript errors when trying to export or type a compiled graph.

**Fix:** Pin Zod version. Use explicit type annotations on the compiled graph variable.

---

## Debugging Strategies

### LangSmith Tracing

Set environment variables:
```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_key
```

All LangGraph invocations are automatically traced. View in LangSmith UI:
- Node input/output state
- LLM calls with full request/response
- Tool call arguments and results
- Timing per step

For non-LangChain code:
```typescript
import { traceable } from "langsmith/traceable";
const myFn = traceable(async (input) => { ... }, { name: "myFn" });
```

### Debug Streaming Mode

```typescript
for await (const event of graph.stream(input, { streamMode: "debug" })) {
  console.log(JSON.stringify(event, null, 2));
}
```

### Custom Event Callbacks

Pass callbacks when building the graph for real-time visibility:
```typescript
const graph = buildGraph(fileSystem, async (event) => {
  console.log(`[${event.type}] ${event.agent}: ${event.content}`);
});
```

### State Inspection

With a checkpointer:
```typescript
const state = await graph.getState({ configurable: { thread_id: "123" } });
console.log("Current state:", JSON.stringify(state.values, null, 2));
```

---

## Error Handling Best Practices

### Three-Level Strategy

**1. Node level:** Wrap each node in try-catch, save error to state:
```typescript
async function myNode(state) {
  try {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  } catch (error) {
    return { errorMessage: String(error), currentAgent: "error_handler" };
  }
}
```

**2. Graph level:** Route to error handlers based on state:
```typescript
graph.addConditionalEdges("myNode", (state) => {
  if (state.errorMessage) return "error_handler";
  return "next_node";
});
```

**3. Application level:** Wrap `graph.invoke()` in try-catch, send partial results on failure:
```typescript
try {
  const result = await graph.invoke(input);
  await sendEvent({ type: "done", result });
} catch (error) {
  // Still send any files/results created before the error
  await sendEvent({ type: "error", partialResults: getPartialResults() });
} finally {
  try { await writer.close(); } catch {}
}
```

### Retry Policies

```typescript
graph.addNode("myNode", myNodeFn, {
  retryPolicy: { maxAttempts: 3, backoffFactor: 2 }
});
```

### Nudge Nodes for Stuck Agents

When an agent fails to use tools, add a "nudge" node that re-prompts:
```typescript
function designNudgeNode(state) {
  return {
    messages: [new HumanMessage("Please use the design tool to create the spec.")],
  };
}

graph.addConditionalEdges("design", (state) => {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg._getType() === "ai" && !(lastMsg as AIMessage).tool_calls?.length) {
    return "design_nudge";
  }
  // ...
});
```
