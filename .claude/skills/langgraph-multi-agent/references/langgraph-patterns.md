# LangGraph.js API Patterns Reference

## Table of Contents

- [StateGraph and Annotation](#stategraph-and-annotation)
- [MessagesAnnotation](#messagesannotation)
- [Nodes and Edges](#nodes-and-edges)
- [Conditional Edges](#conditional-edges)
- [Command and Send](#command-and-send)
- [Tool Calling](#tool-calling)
- [ToolNode and toolsCondition](#toolnode-and-toolscondition)
- [Streaming](#streaming)
- [Checkpointing and Memory](#checkpointing-and-memory)
- [Prebuilt Agents](#prebuilt-agents)

---

## StateGraph and Annotation

### Define State

```typescript
import { StateGraph, Annotation, MessagesAnnotation, START, END } from "@langchain/langgraph";

const MyState = Annotation.Root({
  ...MessagesAnnotation.spec,  // includes messagesStateReducer
  customField: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  counter: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
  items: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
});
```

**Reducer patterns:**
- `(_, b) => b` — last write wins (scalars)
- `(a, b) => a + b` — accumulate (numbers)
- `(a, b) => [...a, ...b]` — append (arrays)
- `messagesStateReducer` — ID-based merge (messages)

**Critical:** If two nodes can update the same key, you MUST define a reducer. Without one, LangGraph throws `InvalidUpdateError`.

### Build and Compile

```typescript
const graph = new StateGraph(MyState)
  .addNode("nodeA", nodeAFn)
  .addNode("nodeB", nodeBFn)
  .addEdge(START, "nodeA")
  .addEdge("nodeA", "nodeB")
  .addEdge("nodeB", END)
  .compile({ recursionLimit: 50 });
```

`compile()` options: `{ checkpointer?, recursionLimit?, interruptBefore?, interruptAfter? }`

---

## MessagesAnnotation

Built-in annotation with `messagesStateReducer` that handles:
- Appending new messages
- Updating existing messages by ID (deduplication)
- Format conversion

```typescript
// Use directly when state is just messages
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentFn)
  .compile();

// Or extend with additional fields
const ExtendedState = Annotation.Root({
  ...MessagesAnnotation.spec,
  extraField: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});
```

**Note:** Use `.spec` when spreading into `Annotation.Root()`.

---

## Nodes and Edges

### Node Function Signature

```typescript
// Nodes receive state and optionally RunnableConfig
async function myNode(
  state: typeof MyState.State,
  config?: RunnableConfig
): Promise<Partial<typeof MyState.State>> {
  // Return only the keys you want to update
  return { customField: "updated" };
}
```

**Rules:**
- Never mutate the incoming `state` object directly
- Return only changed keys (partial state updates)
- LangGraph applies reducers to merge the return value into state

### Edge Types

```typescript
// Static: always go from A to B
graph.addEdge("nodeA", "nodeB");

// From START
graph.addEdge(START, "nodeA");

// To END
graph.addEdge("nodeB", END);

// Conditional: routing function decides
graph.addConditionalEdges("nodeA", routeFn, { option1: "nodeB", option2: "nodeC" });
```

---

## Conditional Edges

```typescript
function routeAgent(state: typeof MyState.State): string {
  const lastMsg = state.messages[state.messages.length - 1];
  // Always type-check before accessing AI-specific properties
  if (lastMsg._getType() === "ai") {
    const aiMsg = lastMsg as AIMessage;
    if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
      return "tools";
    }
  }
  return END;
}

graph.addConditionalEdges("agent", routeAgent, {
  tools: "tool_node",
  [END]: END,
});
```

**Or use prebuilt `toolsCondition`:**

```typescript
import { toolsCondition } from "@langchain/langgraph/prebuilt";
graph.addConditionalEdges("agent", toolsCondition);
// Returns "tools" if tool_calls present, END otherwise
```

---

## Command and Send

### Command: Update State + Route

```typescript
import { Command } from "@langchain/langgraph";

function myNode(state) {
  return new Command({
    update: { counter: state.counter + 1 },
    goto: "next_node",  // or END
  });
}
```

### Send: Dynamic Fan-Out

```typescript
import { Send } from "@langchain/langgraph";

function fanOut(state: { subjects: string[] }) {
  return state.subjects.map(
    (subject) => new Send("process_item", { subject })
  );
}

graph.addConditionalEdges("collector", fanOut);
```

---

## Tool Calling

### Define with `tool()` Helper (Preferred)

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const myTool = tool(
  async ({ query }) => {
    return `Result for: ${query}`;
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({ query: z.string().describe("Search query") }),
  }
);
```

### Define with DynamicStructuredTool

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";

// @ts-expect-error - TS2589 excessive type depth with complex Zod schemas
const myTool = new DynamicStructuredTool({
  name: "my_tool",
  description: "Does something",
  schema: z.object({ input: z.string() }),
  func: async ({ input }) => `Processed: ${input}`,
});
```

### Bind Tools to Model

```typescript
const model = new ChatAnthropic({ model: "claude-haiku-4-5" });
const tools = [myTool];
const modelWithTools = model.bindTools(tools);
// bindTools returns a NEW model instance -- always use the return value
```

---

## ToolNode and toolsCondition

### ToolNode

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Basic
const toolNode = new ToolNode(tools);

// With error handling (RECOMMENDED)
const toolNode = new ToolNode(tools, { handleToolErrors: true });

// With custom error message
const toolNode = new ToolNode(tools, {
  handleToolErrors: "Invalid tool call. Please check arguments and try again.",
});
```

`handleToolErrors: true` catches validation errors and sends them back to the LLM as a `ToolMessage`, allowing retry instead of crashing.

### toolsCondition

```typescript
import { toolsCondition } from "@langchain/langgraph/prebuilt";

// Auto-routes: "tools" if tool_calls present, END otherwise
graph.addConditionalEdges("agent", toolsCondition);
```

### Full Tool-Calling Loop Pattern

```typescript
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", async (state) => {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", new ToolNode(tools, { handleToolErrors: true }))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", toolsCondition)
  .addEdge("tools", "agent")  // loop back after tool execution
  .compile();
```

---

## Streaming

### Stream Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `"values"` | Full state after each node | Debugging, state inspection |
| `"updates"` | Delta from each node | Efficient state tracking |
| `"messages"` | Chat messages, token-by-token | Chatbot UIs |
| `"events"` | Detailed execution events | Logging, analytics |
| `"debug"` | Full debug traces | Development debugging |

### Basic Streaming

```typescript
// Stream updates
for await (const chunk of await graph.stream(
  { messages: [new HumanMessage("Hello")] },
  { streamMode: "updates" }
)) {
  console.log(chunk);
}

// Stream messages (token-by-token)
for await (const chunk of await graph.stream(
  { messages: [new HumanMessage("Hello")] },
  { streamMode: "messages" }
)) {
  console.log(chunk);
}
```

### SSE to Client (Next.js API Route)

```typescript
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  async function sendEvent(event: object) {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // Writer may be closed if client disconnected
    }
  }

  // Launch graph in background
  (async () => {
    try {
      const result = await graph.invoke({ messages });
      await sendEvent({ type: "done", result });
    } catch (error) {
      await sendEvent({ type: "error", message: String(error) });
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### streamEvents (Token-Level)

```typescript
for await (const event of graph.streamEvents(
  { messages: [new HumanMessage("Hello")] },
  { version: "v2" }
)) {
  if (event.event === "on_chat_model_stream") {
    process.stdout.write(event.data?.chunk?.content || "");
  }
}
```

**Caveat:** `streamEvents` has inconsistencies with `ChatAnthropic`. Prefer custom SSE or `graph.stream()` with `streamMode: "messages"`.

---

## Checkpointing and Memory

### MemorySaver (Dev Only)

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = myGraph.compile({ checkpointer });

// MUST pass thread_id when using a checkpointer
const result = await graph.invoke(
  { messages: [new HumanMessage("Hi")] },
  { configurable: { thread_id: "session-123" } }
);
```

### Long-Term Memory (Cross-Thread)

```typescript
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();
const app = graph.compile({ checkpointer, store });
```

### Inspect State

```typescript
const state = await graph.getState({ configurable: { thread_id: "session-123" } });
console.log(state.values.messages);
```

---

## Prebuilt Agents

### createReactAgent

Returns a **compiled** graph (do NOT call `.compile()` on it).

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const agent = createReactAgent({
  llm: model,
  tools: [myTool],
  prompt: "You are a helpful assistant.",     // simple system message
  // OR: messageModifier: new SystemMessage("..."),  // for more control
  // checkpointSaver: new MemorySaver(),     // for multi-turn
  // name: "my_agent",                       // required for multi-agent
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Hello" }],
});
```

### createSupervisor

Returns a **StateGraph** (MUST call `.compile()`).

```typescript
import { createSupervisor } from "@langchain/langgraph-supervisor";

const supervisorGraph = createSupervisor({
  agents: [agentA, agentB],  // createReactAgent instances with `name`
  llm: model,
  prompt: "Route tasks to the right agent.",
});

const app = supervisorGraph.compile();
```

### createSwarm

Returns a **StateGraph** (MUST call `.compile()`).

```typescript
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";

const agentA = createReactAgent({
  llm: model,
  tools: [myTool, createHandoffTool({ agentName: "agentB" })],
  name: "agentA",
});

const swarm = createSwarm({
  agents: [agentA, agentB],
  defaultActiveAgent: "agentA",
});

const app = swarm.compile({ checkpointer: new MemorySaver() });
```

### Return Type Summary

| Function | Returns | Need `.compile()`? |
|----------|---------|-------------------|
| `createReactAgent` | Compiled graph | No |
| `createSupervisor` | `StateGraph` | Yes |
| `createSwarm` | `StateGraph` | Yes |
