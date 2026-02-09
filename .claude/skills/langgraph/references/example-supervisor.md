# Example: Supervisor with Prebuilt

A supervisor LLM dynamically routes tasks to specialized agents.

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

## Key Points

- `createSupervisor` returns a **StateGraph** — you MUST call `.compile()` on it
- `createReactAgent` returns a **compiled graph** — do NOT call `.compile()` on it
- Each agent needs a unique `name` for the supervisor to route to it
- The supervisor makes an extra LLM call per routing decision (latency trade-off)
- The supervisor `prompt` guides routing behavior — be specific about which agent handles what

## Return Type Reference

| Function | Returns | Need `.compile()`? | Package |
| -------- | ------- | ------------------ | ------- |
| `createAgent` | Compiled graph | No | `langchain` |
| `createReactAgent` | Compiled graph | No | `@langchain/langgraph/prebuilt` |
| `createSupervisor` | `StateGraph` | Yes | `@langchain/langgraph-supervisor` |
| `createSwarm` | `StateGraph` | Yes | `@langchain/langgraph-swarm` |
