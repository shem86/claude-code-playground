import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { isMockProvider } from "@/lib/provider";
import { AgentRole, type AgentStreamEvent, type AgentMessage } from "@/lib/agents/types";
import { saveProjectState } from "@/lib/agents/save-project";
import { runMockMultiAgentFlow } from "@/lib/agents/mock-flow";

export async function POST(req: Request) {
  let body: { messages?: unknown; files?: unknown; projectId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const { messages, files, projectId } = body;

  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }
  if (!files || typeof files !== "object") {
    return Response.json({ error: "files must be an object" }, { status: 400 });
  }

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files as Record<string, FileNode>);

  // Collect events to stream back to the client
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to write SSE-formatted data (try-catch guards against client disconnect)
  async function sendEvent(event: AgentStreamEvent) {
    try {
      const data = JSON.stringify(event);
      await writer.write(encoder.encode(`data: ${data}\n\n`));
    } catch {
      // Writer may be closed if client disconnected
    }
  }

  // Extract the last user message
  const userMessages = messages.filter((m: any) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const userContent =
    typeof lastUserMessage?.content === "string"
      ? lastUserMessage.content
      : Array.isArray(lastUserMessage?.content)
        ? lastUserMessage.content.map((p: any) => p.text || "").join(" ")
        : "Create a React component";

  if (isMockProvider()) {
    runMockMultiAgentFlow(userContent, fileSystem, sendEvent, writer, messages, projectId);
  } else {
    runRealMultiAgentFlow(userContent, fileSystem, sendEvent, writer, messages, projectId);
  }

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function toAgentMessage(event: AgentStreamEvent): AgentMessage {
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    agent: event.agent,
    type: event.type,
    content: event.content || "",
    timestamp: Date.now(),
    toolName: event.toolName,
    toolArgs: event.toolArgs,
  };
}

// ---------------------------------------------------------------------------
// Real multi-agent flow (requires API key)
// ---------------------------------------------------------------------------

function runRealMultiAgentFlow(
  userContent: string,
  fileSystem: VirtualFileSystem,
  sendEvent: (e: AgentStreamEvent) => Promise<void>,
  writer: WritableStreamDefaultWriter,
  messages: any[],
  projectId?: string
) {
  (async () => {
    const collectedEvents: AgentMessage[] = [];

    try {
      const orchestratorStart: AgentStreamEvent = {
        type: "agent_start",
        agent: AgentRole.ORCHESTRATOR,
        content: "Starting multi-agent workflow...",
      };
      collectedEvents.push(toAgentMessage(orchestratorStart));
      await sendEvent(orchestratorStart);

      // Dynamic imports so LangChain only loads when actually needed
      const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
      const { HumanMessage } = await import("@langchain/core/messages");

      const graph = buildMultiAgentGraph(fileSystem, async (event) => {
        collectedEvents.push(toAgentMessage(event));
        try {
          await sendEvent(event);
        } catch {
          // Writer may be closed
        }
      });

      // Include existing file context so agents know what's already in the filesystem
      const existingFiles = fileSystem.getAllFiles();
      let messageContent = userContent;
      if (existingFiles.size > 0) {
        const fileList = Array.from(existingFiles.keys()).join("\n");
        messageContent += `\n\n[EXISTING FILES in the virtual filesystem — use "view" to read them before making changes]\n${fileList}`;
      }

      const result = await graph.invoke(
        { messages: [new HumanMessage(messageContent)] },
        { recursionLimit: 80 }
      );

      const agentMessages = result.messages || [];

      await sendEvent({
        type: "workflow_done",
        agent: AgentRole.ORCHESTRATOR,
        content: JSON.stringify({
          files: fileSystem.serialize(),
          messageCount: agentMessages.length,
        }),
      });

      if (projectId) {
        const summaryParts: string[] = [];
        for (const msg of agentMessages) {
          if (msg.getType() === "ai") {
            const content = msg.content;
            let text = "";
            if (typeof content === "string") {
              text = content.trim();
            } else if (Array.isArray(content)) {
              text = (content as Array<{ type: string; text?: string }>)
                .filter((block) => block.type === "text" && block.text)
                .map((block) => block.text!)
                .join("\n")
                .trim();
            }
            if (text) {
              summaryParts.push(text);
            }
          }
        }

        const allMessages = [
          ...messages,
          {
            id: `multi-agent-${crypto.randomUUID()}`,
            role: "assistant",
            content: summaryParts.join("\n\n") || "Multi-agent workflow completed.",
          },
        ];

        await saveProjectState(projectId, allMessages, fileSystem.serialize(), collectedEvents);
      }
    } catch (error) {
      console.error("Multi-agent workflow error:", error);
      try {
        // Still send any files that were created before the error
        const serialized = fileSystem.serialize();
        const hasFiles = Object.keys(serialized).length > 1; // more than just root "/"
        await sendEvent({
          type: "workflow_done",
          agent: AgentRole.ORCHESTRATOR,
          content: JSON.stringify({
            ...(hasFiles ? { files: serialized } : {}),
            error: String(error),
          }),
        });
      } catch {
        // Writer may already be closed
      }

      if (projectId) {
        const errorMessages = [
          ...messages,
          {
            id: `multi-agent-error-${crypto.randomUUID()}`,
            role: "assistant",
            content: `Multi-agent workflow failed: ${String(error)}`,
          },
        ];
        await saveProjectState(projectId, errorMessages, fileSystem.serialize(), collectedEvents);
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    }
  })();
}

export const maxDuration = 300;
