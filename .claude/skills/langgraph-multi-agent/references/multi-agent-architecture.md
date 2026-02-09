# Multi-Agent Architecture Guide

## Table of Contents

- [Philosophy](#philosophy)
- [When to Use Multi-Agent](#when-to-use-multi-agent)
- [Pattern Comparison](#pattern-comparison)
- [Pattern 1: Custom StateGraph](#pattern-1-custom-stategraph)
- [Pattern 2: Prebuilt Supervisor](#pattern-2-prebuilt-supervisor)
- [Pattern 3: Swarm with Handoffs](#pattern-3-swarm-with-handoffs)
- [Pattern Selection Guide](#pattern-selection-guide)
- [Communication Patterns](#communication-patterns)
- [Scaling Considerations](#scaling-considerations)

---

## Philosophy

Multi-agent systems decompose complex tasks into specialized roles. Each agent has a focused system prompt, a constrained tool set, and a clear responsibility boundary. Benefits:

- **Specialization**: Agents with narrow scope produce higher-quality output than a generalist
- **Modularity**: Swap, add, or remove agents without rewriting the whole system
- **Controllability**: Explicit routing logic makes behavior predictable and debuggable
- **Token efficiency**: Each agent only receives context relevant to its role

The fundamental trade-off: **more agents = more LLM calls = more latency and cost**. Only add agents when the task genuinely benefits from specialization.

## When to Use Multi-Agent

Use multi-agent when:
- The task has **distinct phases** requiring different expertise (design, implementation, review)
- Different **tool sets** are needed at different stages
- You need **quality gates** between phases (e.g., QA review before final output)
- The problem benefits from **iterative refinement** across roles

Use single-agent when:
- The task is straightforward and linear
- One tool set covers all needs
- Latency matters more than specialization
- The context window can handle the full task

## Pattern Comparison

| Aspect | Custom StateGraph | Supervisor | Swarm |
|--------|------------------|------------|-------|
| Control | Full | Medium | Low |
| Complexity | High | Low | Low |
| Routing | Explicit edges | LLM decides | Agents decide |
| Latency overhead | Minimal | 1 extra LLM call/route | ~40% faster than supervisor |
| Best for | Fixed workflows | Dynamic task delegation | Peer-to-peer collaboration |

## Pattern 1: Custom StateGraph

Build each agent as a node with its own model+tools, connected by explicit edges and routing functions.

**When to use**: Fixed, predictable workflow where you know the agent sequence at compile time.

```typescript
import { StateGraph, Annotation, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";

const WorkflowState = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentAgent: Annotation<string>({ reducer: (_, b) => b, default: () => "design" }),
  iterationCount: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
});

const model = new ChatAnthropic({ model: "claude-haiku-4-5" });
const designModel = model.bindTools([designTool]);
const engineerModel = model.bindTools([strReplaceTool, fileManagerTool]);

// Each agent is a node function
async function designNode(state: typeof WorkflowState.State) {
  const response = await designModel.invoke([
    new SystemMessage("You are a design expert..."),
    ...state.messages,
  ]);
  return { messages: [response], currentAgent: "design" };
}

async function engineerNode(state: typeof WorkflowState.State) {
  const response = await engineerModel.invoke([
    new SystemMessage("You are an engineer..."),
    ...state.messages,
  ]);
  return { messages: [response], currentAgent: "engineer" };
}

// Routing function checks for tool calls
function routeDesign(state: typeof WorkflowState.State) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg._getType() === "ai" && (lastMsg as AIMessage).tool_calls?.length) {
    return "design_tools";
  }
  return "engineer"; // move to next phase
}

const graph = new StateGraph(WorkflowState)
  .addNode("design", designNode)
  .addNode("design_tools", new ToolNode([designTool], { handleToolErrors: true }))
  .addNode("engineer", engineerNode)
  .addNode("engineer_tools", new ToolNode([strReplaceTool, fileManagerTool], { handleToolErrors: true }))
  .addEdge(START, "design")
  .addConditionalEdges("design", routeDesign, {
    design_tools: "design_tools",
    engineer: "engineer",
  })
  .addEdge("design_tools", "design")
  .addConditionalEdges("engineer", routeEngineer, { ... })
  .addEdge("engineer_tools", "engineer")
  .compile({ recursionLimit: 80 });
```

**Key design decisions**:
- Each agent gets its own system prompt prepended at invocation time
- Routing functions inspect the last message to decide: tool call → tools node, or advance to next agent
- Iteration counters prevent infinite revision loops
- `handleToolErrors: true` lets the LLM retry on invalid tool calls

## Pattern 2: Prebuilt Supervisor

An orchestrator LLM decides which agent to invoke next. Minimal code, maximum flexibility.

**When to use**: Dynamic task routing where the order of agents depends on the input.

```typescript
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({ model: "claude-haiku-4-5" });

const designAgent = createReactAgent({
  llm: model,
  tools: [designTool],
  name: "designer",
  prompt: "You are a UI/UX design expert.",
});

const engineerAgent = createReactAgent({
  llm: model,
  tools: [strReplaceTool, fileManagerTool],
  name: "engineer",
  prompt: "You are a React engineer.",
});

// createSupervisor returns a StateGraph -- must .compile()
const supervisorGraph = createSupervisor({
  agents: [designAgent, engineerAgent],
  llm: model,
  prompt: "Route design tasks to designer, implementation to engineer.",
});

const app = supervisorGraph.compile();
const result = await app.invoke({
  messages: [{ role: "user", content: "Build a todo app" }],
});
```

**Trade-offs**:
- Extra LLM call per routing decision (supervisor must decide who goes next)
- Less predictable than explicit edges
- Cannot import in client components (server-only)

## Pattern 3: Swarm with Handoffs

Agents transfer control directly to each other using handoff tools. No central orchestrator.

**When to use**: Peer-to-peer collaboration where agents know when to delegate.

```typescript
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

const designer = createReactAgent({
  llm: model,
  tools: [designTool, createHandoffTool({ agentName: "engineer" })],
  name: "designer",
  prompt: "Design expert. Hand off to engineer when the spec is ready.",
});

const engineer = createReactAgent({
  llm: model,
  tools: [strReplaceTool, createHandoffTool({ agentName: "designer" })],
  name: "engineer",
  prompt: "React engineer. Hand off to designer if design clarification is needed.",
});

const swarm = createSwarm({
  agents: [designer, engineer],
  defaultActiveAgent: "designer",
});

// createSwarm returns a StateGraph -- must .compile()
const app = swarm.compile({ checkpointer: new MemorySaver() });
const result = await app.invoke(
  { messages: [{ role: "user", content: "Build a dashboard" }] },
  { configurable: { thread_id: "session-1" } }
);
```

**Trade-offs**:
- ~40% faster than supervisor (no routing LLM call)
- Less centralized control -- agents decide when to hand off
- Requires checkpointer for multi-turn conversations

## Pattern Selection Guide

```
Is the agent sequence fixed and predictable?
├── Yes → Custom StateGraph
└── No
    ├── Do you need a central orchestrator deciding routing?
    │   ├── Yes → Supervisor
    │   └── No → Swarm
    └── Are agents peers that hand off directly?
        ├── Yes → Swarm
        └── No → Supervisor
```

## Communication Patterns

### Shared State (Default)
All agents read/write from the same state object. Messages accumulate across agents.

```typescript
// Each agent appends to the shared messages array
return { messages: [response], currentAgent: "engineer" };
```

### State Scoping
Agents can have dedicated state fields to avoid interference:

```typescript
const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  designSpec: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  engineerOutput: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  qaFeedback: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});
```

### Command-Based Routing
Nodes can update state AND choose the next node in a single return:

```typescript
import { Command } from "@langchain/langgraph";

function qaNode(state) {
  if (state.iterationCount >= MAX_ITERATIONS) {
    return new Command({ goto: END });
  }
  if (needsRevision) {
    return new Command({
      update: { iterationCount: state.iterationCount + 1 },
      goto: "engineer",
    });
  }
  return new Command({ goto: END });
}
```

## Scaling Considerations

1. **Message array growth**: Each agent prepends SystemMessage + all messages. With many iterations, this hits token limits. Mitigate by summarizing or truncating earlier messages.

2. **Latency**: Each agent = 1+ LLM calls. A Design→Engineer→QA loop with tool calls can take 30-60 seconds. Consider streaming to keep the user informed.

3. **Cost**: Multi-agent multiplies LLM calls. Use cheaper models (haiku) for routine agents, expensive models (sonnet/opus) only for complex reasoning.

4. **Error propagation**: One agent failure can cascade. Add error handling at node level and graph level. Send partial results to client even on failure.

5. **Checkpointing for long workflows**: Without a checkpointer, server crash = total loss. For workflows > 30 seconds, consider persistent checkpointing.
