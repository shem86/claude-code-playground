import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { isMockProvider } from "@/lib/provider";
import { AgentRole, type AgentStreamEvent } from "@/lib/agents/types";
import { saveProjectState } from "@/lib/agents/save-project";
import { runMockMultiAgentFlow } from "@/lib/agents/mock-flow";

export async function POST(req: Request) {
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } = await req.json();

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

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
    try {
      await sendEvent({
        type: "agent_start",
        agent: AgentRole.ORCHESTRATOR,
        content: "Starting multi-agent workflow...",
      });

      // Dynamic imports so LangChain only loads when actually needed
      const { buildMultiAgentGraph } = await import("@/lib/agents/graph");
      const { HumanMessage } = await import("@langchain/core/messages");

      const graph = buildMultiAgentGraph(fileSystem, async (event) => {
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
          if (msg.getType() === "ai" && typeof msg.content === "string" && msg.content.trim()) {
            summaryParts.push(msg.content);
          }
        }

        const allMessages = [
          ...messages,
          {
            id: `multi-agent-${Date.now()}`,
            role: "assistant",
            content: summaryParts.join("\n\n") || "Multi-agent workflow completed.",
          },
        ];

        await saveProjectState(projectId, allMessages, fileSystem.serialize());
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
