import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock dynamic imports before importing the module under test
vi.mock("@/lib/agents/graph", () => ({
  buildMultiAgentGraph: vi.fn(),
}));

vi.mock("@/lib/agents/save-project", () => ({
  saveProjectState: vi.fn(),
}));

vi.mock("@/lib/provider", () => ({
  isMockProvider: vi.fn(() => false),
}));

vi.mock("@/lib/agents/mock-flow", () => ({
  runMockMultiAgentFlow: vi.fn(),
}));

// Helper: read an SSE stream to completion with a timeout
async function readSSEStream(response: Response, timeoutMs = 3000): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Stream never closed — writer not properly closed")),
      timeoutMs
    );
    (async () => {
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value);
      }
      clearTimeout(timeout);
      resolve(text);
    })();
  });
}

// Helper: build a minimal POST request
function makeRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/chat/multi-agent", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "make a button" }],
      files: {},
      ...body,
    }),
  });
}

describe("POST — Issue #5: input validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("returns 400 when messages is missing from the request body", async () => {
    const { POST } = await import("../route");

    const request = new Request("http://localhost/api/chat/multi-agent", {
      method: "POST",
      body: JSON.stringify({ files: {} }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test("returns 400 when messages is not an array", async () => {
    const { POST } = await import("../route");

    const request = new Request("http://localhost/api/chat/multi-agent", {
      method: "POST",
      body: JSON.stringify({ messages: "not-an-array", files: {} }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  test("returns 400 when files is missing from the request body", async () => {
    const { POST } = await import("../route");

    const request = new Request("http://localhost/api/chat/multi-agent", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  test("returns 400 when request body is not valid JSON", async () => {
    const { POST } = await import("../route");

    const request = new Request("http://localhost/api/chat/multi-agent", {
      method: "POST",
      body: "not json at all",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe("runRealMultiAgentFlow — Issue #7: array content blocks in summary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("AI messages with array content blocks are included in the saved project summary", async () => {
    // LangChain AI messages can have content as an array of content blocks:
    //   [{ type: "text", text: "..." }, { type: "tool_use", ... }]
    // The current code only checks `typeof msg.content === "string"`, which
    // silently drops messages with array content. The fix should extract
    // text from both formats.

    const { POST } = await import("../route");
    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    const { saveProjectState } = await import("@/lib/agents/save-project");

    // Create a fake graph that returns messages with array content blocks
    const fakeGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          {
            getType: () => "ai",
            // Array content block format (common from Claude)
            content: [
              { type: "text", text: "Design spec: A blue button component" },
              { type: "tool_use", id: "1", name: "create_design_spec", input: {} },
            ],
          },
          {
            getType: () => "ai",
            content: "Implementation complete.",  // String format
          },
          {
            getType: () => "ai",
            // Array with only text blocks
            content: [
              { type: "text", text: "QA review passed." },
            ],
          },
        ],
      }),
    };

    vi.mocked(buildMultiAgentGraph).mockReturnValue(fakeGraph as any);
    vi.mocked(saveProjectState).mockResolvedValue(undefined);

    const request = makeRequest({ projectId: "test-project-123" });
    const response = await POST(request);
    await readSSEStream(response);

    // saveProjectState should have been called with a summary that
    // includes text from BOTH string and array content blocks
    expect(saveProjectState).toHaveBeenCalledTimes(1);

    const savedMessages = vi.mocked(saveProjectState).mock.calls[0][1];
    const assistantMsg = savedMessages.find(
      (m: any) => m.role === "assistant" && m.id?.startsWith("multi-agent-")
    );

    expect(assistantMsg).toBeDefined();
    // The summary should include text from the array content block messages
    expect(assistantMsg.content).toContain("Design spec: A blue button component");
    expect(assistantMsg.content).toContain("Implementation complete.");
    expect(assistantMsg.content).toContain("QA review passed.");
  });
});

describe("runRealMultiAgentFlow — Issue #8: message ID uniqueness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("saved assistant message uses a UUID instead of Date.now()-based ID", async () => {
    const { POST } = await import("../route");
    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    const { saveProjectState } = await import("@/lib/agents/save-project");

    const fakeGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [
          { getType: () => "ai", content: "Done." },
        ],
      }),
    };
    vi.mocked(buildMultiAgentGraph).mockReturnValue(fakeGraph as any);
    vi.mocked(saveProjectState).mockResolvedValue(undefined);

    const response = await POST(makeRequest({ projectId: "proj-1" }));
    await readSSEStream(response);

    const savedMessages = vi.mocked(saveProjectState).mock.calls[0][1];
    const assistantMsg = savedMessages.find(
      (m: any) => m.role === "assistant" && m.id?.startsWith("multi-agent-")
    );

    expect(assistantMsg).toBeDefined();
    // The ID should NOT be a timestamp-based format like "multi-agent-1234567890123"
    // It should use a UUID pattern: "multi-agent-xxxxxxxx-xxxx-..."
    const idSuffix = assistantMsg.id.replace("multi-agent-", "");
    // UUID v4 pattern: 8-4-4-4-12 hex chars
    expect(idSuffix).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("runRealMultiAgentFlow — agent event persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("saves collected agent events to the project on success", async () => {
    const { POST } = await import("../route");
    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    const { saveProjectState } = await import("@/lib/agents/save-project");

    // The graph callback receives events via onEvent. We capture the callback
    // and simulate the graph emitting events through it.
    let onEventCallback: ((event: any) => void) | undefined;

    const fakeGraph = {
      invoke: vi.fn().mockImplementation(async () => {
        // Simulate agents emitting events during the workflow
        if (onEventCallback) {
          onEventCallback({ type: "agent_start", agent: "design", content: "Starting design" });
          onEventCallback({ type: "agent_message", agent: "design", content: "Here is the design" });
          onEventCallback({ type: "agent_done", agent: "design", content: "Design complete" });
          onEventCallback({ type: "agent_start", agent: "engineer", content: "Starting engineering" });
          onEventCallback({ type: "agent_message", agent: "engineer", content: "Code written" });
          onEventCallback({ type: "agent_done", agent: "engineer", content: "Engineering complete" });
        }
        return { messages: [{ getType: () => "ai", content: "Done." }] };
      }),
    };

    vi.mocked(buildMultiAgentGraph).mockImplementation((fs, onEvent) => {
      onEventCallback = onEvent as any;
      return fakeGraph as any;
    });
    vi.mocked(saveProjectState).mockResolvedValue(undefined);

    const response = await POST(makeRequest({ projectId: "proj-events" }));
    await readSSEStream(response);

    expect(saveProjectState).toHaveBeenCalledTimes(1);

    // The 4th argument should be the collected agent events
    const savedAgentRun = vi.mocked(saveProjectState).mock.calls[0][3];
    expect(savedAgentRun).toBeDefined();
    // 1 orchestrator start + 6 graph events + workflow_done
    expect(savedAgentRun!.length).toBeGreaterThanOrEqual(7);
    // First event is orchestrator start
    expect(savedAgentRun![0]).toMatchObject({
      agent: "orchestrator",
      type: "agent_start",
    });
    // Should include events from design and engineer agents
    const designEvents = savedAgentRun!.filter((e: any) => e.agent === "design");
    expect(designEvents.length).toBeGreaterThanOrEqual(3);
    const engineerEvents = savedAgentRun!.filter((e: any) => e.agent === "engineer");
    expect(engineerEvents.length).toBeGreaterThanOrEqual(2);
  });

  test("saves agent events even when the workflow fails", async () => {
    const { POST } = await import("../route");
    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    const { saveProjectState } = await import("@/lib/agents/save-project");

    let onEventCallback: ((event: any) => void) | undefined;

    const fakeGraph = {
      invoke: vi.fn().mockImplementation(async () => {
        if (onEventCallback) {
          onEventCallback({ type: "agent_start", agent: "design", content: "Starting" });
          onEventCallback({ type: "agent_message", agent: "design", content: "Partial work" });
        }
        throw new Error("LLM rate limit exceeded");
      }),
    };

    vi.mocked(buildMultiAgentGraph).mockImplementation((fs, onEvent) => {
      onEventCallback = onEvent as any;
      return fakeGraph as any;
    });
    vi.mocked(saveProjectState).mockResolvedValue(undefined);

    const response = await POST(makeRequest({ projectId: "proj-fail" }));
    await readSSEStream(response);

    // saveProjectState should still be called on failure
    expect(saveProjectState).toHaveBeenCalledTimes(1);

    // Check saved messages include the error
    const savedMessages = vi.mocked(saveProjectState).mock.calls[0][1];
    const errorMsg = savedMessages.find((m: any) => m.role === "assistant");
    expect(errorMsg.content).toContain("LLM rate limit exceeded");

    // Check agent events were saved (orchestrator start + 2 design events)
    const savedAgentRun = vi.mocked(saveProjectState).mock.calls[0][3];
    expect(savedAgentRun).toBeDefined();
    expect(savedAgentRun!.length).toBeGreaterThanOrEqual(3);
    expect(savedAgentRun![0]).toMatchObject({
      agent: "orchestrator",
      type: "agent_start",
    });
    const designEvents = savedAgentRun!.filter((e: any) => e.agent === "design");
    expect(designEvents.length).toBeGreaterThanOrEqual(2);
  });

  test("does not save agent events when no projectId", async () => {
    const { POST } = await import("../route");
    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    const { saveProjectState } = await import("@/lib/agents/save-project");

    const fakeGraph = {
      invoke: vi.fn().mockResolvedValue({
        messages: [{ getType: () => "ai", content: "Done." }],
      }),
    };

    vi.mocked(buildMultiAgentGraph).mockReturnValue(fakeGraph as any);

    // No projectId in request
    const response = await POST(makeRequest());
    await readSSEStream(response);

    expect(saveProjectState).not.toHaveBeenCalled();
  });
});

describe("runRealMultiAgentFlow — Issue #1: fire-and-forget promise", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("no unhandled promise rejections are emitted during POST execution", async () => {
    // The IIFE pattern `(async () => { ... })()` discards the promise.
    // If Node is configured with --unhandled-rejections=throw (default since v15),
    // any rejection that escapes the inner try/catch crashes the process.
    //
    // This test registers a listener for unhandled rejections and asserts
    // that none occur during the full lifecycle of a POST call.

    const { POST } = await import("../route");

    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    vi.mocked(buildMultiAgentGraph).mockImplementation(() => {
      throw new Error("Graph build failed");
    });

    const unhandledRejections: unknown[] = [];
    const handler = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", handler);

    try {
      const response = await POST(makeRequest());
      await readSSEStream(response);

      // Give the event loop a tick for any stray rejections to surface
      await new Promise((r) => setTimeout(r, 50));

      expect(unhandledRejections).toEqual([]);
    } finally {
      process.removeListener("unhandledRejection", handler);
    }
  });

  test("POST returns a well-formed SSE response even when the graph throws", async () => {
    const { POST } = await import("../route");

    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    vi.mocked(buildMultiAgentGraph).mockImplementation(() => {
      throw new Error("Graph build failed");
    });

    const response = await POST(makeRequest());

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await readSSEStream(response);

    // The error should be communicated through the stream, not lost
    expect(text).toContain("workflow_done");
    expect(text).toContain("Graph build failed");
  });

  test("writer is closed after an error (stream terminates, does not hang)", async () => {
    const { POST } = await import("../route");

    const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
    vi.mocked(buildMultiAgentGraph).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const response = await POST(makeRequest());

    // If the writer is properly closed, readSSEStream resolves before timeout.
    // If not, it rejects with "Stream never closed".
    const result = await readSSEStream(response);
    expect(result).toBeDefined();
  });
});
