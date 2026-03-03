import type { FileNode } from "@/lib/file-system";

interface ChatRequestData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  files: Record<string, FileNode>;
  projectId: string | undefined;
}

type ValidationResult =
  | { ok: true; data: ChatRequestData }
  | { ok: false; response: Response };

export async function validateChatRequest(req: Request): Promise<ValidationResult> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON in request body" }, { status: 400 }),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: Response.json({ error: "Request body must be a JSON object" }, { status: 400 }),
    };
  }

  const { messages, files, projectId } = body as Record<string, unknown>;

  if (!Array.isArray(messages)) {
    return {
      ok: false,
      response: Response.json({ error: "messages must be an array" }, { status: 400 }),
    };
  }

  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return {
      ok: false,
      response: Response.json({ error: "files must be an object" }, { status: 400 }),
    };
  }

  return {
    ok: true,
    data: {
      messages,
      files: files as Record<string, FileNode>,
      projectId: typeof projectId === "string" ? projectId : undefined,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractUserContent(messages: any[]): string {
  const userMessages = messages.filter((m) => m.role === "user");
  const last = userMessages[userMessages.length - 1];
  if (!last) return "Create a React component";
  if (typeof last.content === "string") return last.content;
  if (Array.isArray(last.content)) {
    return last.content.map((p: { text?: string }) => p.text ?? "").join(" ");
  }
  return "Create a React component";
}
