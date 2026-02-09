"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { Message } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";
import type { AgentStreamEvent, AgentRoleType } from "@/lib/agents/types";

export type AgentMode = "single" | "multi";

export interface AgentMessage {
  id: string;
  agent: AgentRoleType;
  type: AgentStreamEvent["type"];
  content: string;
  timestamp: number;
  toolName?: string;
  toolArgs?: Record<string, any>;
}

interface ChatContextProps {
  projectId?: string;
  initialMessages?: Message[];
}

interface ChatContextType {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string;
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;
  agentMessages: AgentMessage[];
  isMultiAgentRunning: boolean;
}

function parseSSEEvent(line: string): AgentStreamEvent | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
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

async function consumeSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: AgentStreamEvent) => void
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const event = parseSSEEvent(line);
      if (event) onEvent(event);
    }
  }

  // Flush any remaining buffered event
  if (buffer.trim()) {
    const event = parseSSEEvent(buffer.trim());
    if (event) onEvent(event);
  }
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall, refreshFileSystem } = useFileSystem();
  const [agentMode, setAgentMode] = useState<AgentMode>(
    process.env.NEXT_PUBLIC_ENABLE_SINGLE_AGENT === "true" ? "single" : "multi"
  );
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isMultiAgentRunning, setIsMultiAgentRunning] = useState(false);
  const [multiAgentMessages, setMultiAgentMessages] = useState<Message[]>(initialMessages);

  const {
    messages: singleMessages,
    input: singleInput,
    handleInputChange: singleHandleInputChange,
    handleSubmit: singleHandleSubmit,
    status: singleStatus,
  } = useAIChat({
    api: "/api/chat",
    initialMessages,
    body: {
      files: fileSystem.serialize(),
      projectId,
    },
    onToolCall: ({ toolCall }) => {
      handleToolCall(toolCall);
    },
  });

  // Multi-agent input state
  const [multiInput, setMultiInput] = useState("");

  const multiHandleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMultiInput(e.target.value);
  }, []);

  const multiHandleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!multiInput.trim() || isMultiAgentRunning) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: multiInput.trim(),
      };

      setMultiAgentMessages((prev) => [...prev, userMessage]);
      setAgentMessages([]);
      setIsMultiAgentRunning(true);
      setMultiInput("");

      try {
        const response = await fetch("/api/chat/multi-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...multiAgentMessages, userMessage],
            files: fileSystem.serialize(),
            projectId,
          }),
        });

        if (!response.ok) {
          let errorMsg = `Multi-agent request failed: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) errorMsg = errorData.error;
          } catch {
            // Response wasn't JSON
          }
          throw new Error(errorMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        await consumeSSEStream(reader, (event) => {
          setAgentMessages((prev) => [...prev, toAgentMessage(event)]);

          if (event.type === "workflow_done") {
            try {
              const data = JSON.parse(event.content || "{}");
              if (data.files) {
                fileSystem.deserializeFromNodes(data.files);
                refreshFileSystem();
              } else if (data.error) {
                console.error("Multi-agent workflow error:", data.error);
              }
            } catch (parseError) {
              console.error("Failed to parse workflow result:", parseError);
            }
          }
        });

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Multi-agent workflow completed. Check the preview to see the results.",
        };
        setMultiAgentMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Multi-agent error:", error);
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Multi-agent workflow failed"}`,
        };
        setMultiAgentMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsMultiAgentRunning(false);
      }
    },
    [multiInput, isMultiAgentRunning, multiAgentMessages, fileSystem, projectId, refreshFileSystem]
  );

  // Select the right set of values based on mode
  const messages = agentMode === "single" ? singleMessages : multiAgentMessages;
  const input = agentMode === "single" ? singleInput : multiInput;
  const handleInputChange =
    agentMode === "single" ? singleHandleInputChange : multiHandleInputChange;
  const handleSubmit = agentMode === "single" ? singleHandleSubmit : multiHandleSubmit;
  const status =
    agentMode === "single" ? singleStatus : isMultiAgentRunning ? "streaming" : "ready";

  // Track anonymous work
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
        agentMode,
        setAgentMode,
        agentMessages,
        isMultiAgentRunning,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
