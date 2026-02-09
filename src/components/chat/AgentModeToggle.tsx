"use client";

import { useChat } from "@/lib/contexts/chat-context";
import { Users, User } from "lucide-react";

export function AgentModeToggle() {
  const { agentMode, setAgentMode, isMultiAgentRunning, status } = useChat();

  const isDisabled = isMultiAgentRunning || status === "streaming" || status === "submitted";

  return (
    <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
      <button
        onClick={() => setAgentMode("single")}
        disabled={isDisabled}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
          agentMode === "single"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-500 hover:text-neutral-700"
        } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        title="Single Agent Mode"
      >
        <User className="w-3 h-3" />
        Single
      </button>
      <button
        onClick={() => setAgentMode("multi")}
        disabled={isDisabled}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
          agentMode === "multi"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-500 hover:text-neutral-700"
        } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        title="Multi-Agent Mode (Design + Engineer + QA)"
      >
        <Users className="w-3 h-3" />
        Multi
      </button>
    </div>
  );
}
