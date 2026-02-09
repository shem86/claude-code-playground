# Example: Single Agent with Tools

## Using createAgent (v1 — Preferred)

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

## Using createReactAgent (Legacy — Still Works)

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";

const agent = createReactAgent({
  llm: new ChatAnthropic({ model: "claude-haiku-4-5" }),
  tools: [searchTool],
  prompt: "You are a helpful assistant.",
});
```

## Key Differences

| Aspect | `createAgent` (v1) | `createReactAgent` (legacy) |
|--------|--------------------|-----------------------------|
| Package | `langchain` | `@langchain/langgraph/prebuilt` |
| Model param | `model: "claude-haiku-4-5"` (string) | `llm: new ChatAnthropic(...)` (instance) |
| Prompt param | `systemPrompt` | `prompt` |
| Middleware | Supported (`middleware: [...]`) | Not supported |
| Streaming node | `"model"` | `"agent"` |
