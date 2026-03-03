import { VirtualFileSystem } from "@/lib/file-system";
import { isMockProvider } from "@/lib/provider";
import type { AgentStreamEvent } from "@/lib/agents/types";
import { runMockMultiAgentFlow } from "@/lib/agents/mock-flow";
import { runRealMultiAgentFlow } from "@/lib/agents/real-flow";
import { validateChatRequest, extractUserContent } from "@/lib/api/validate-chat-request";

export async function POST(req: Request) {
  const validation = await validateChatRequest(req);
  if (!validation.ok) return validation.response;
  const { messages, files, projectId } = validation.data;

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

  const userContent = extractUserContent(messages);

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

export const maxDuration = 300;
