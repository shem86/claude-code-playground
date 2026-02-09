"use client";

import { Loader2, CheckCircle2, PlayCircle, FileCode2, Wrench } from "lucide-react";
import { AgentBadge } from "./AgentBadge";
import { AGENT_REGISTRY, type AgentRoleType } from "@/lib/agents/types";
import type { AgentMessage } from "@/lib/contexts/chat-context";

interface AgentActivityFeedProps {
  agentMessages: AgentMessage[];
  isRunning: boolean;
}

function ToolCallPill({ message }: { message: AgentMessage }) {
  // Show a compact pill for tool invocations
  const toolName = message.toolName || "tool";
  const isFileOp = toolName === "str_replace_editor" || toolName === "file_manager";
  const path = message.toolArgs?.path;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 text-xs text-neutral-600 font-mono">
      {isFileOp ? (
        <FileCode2 className="w-3 h-3 text-neutral-400" />
      ) : (
        <Wrench className="w-3 h-3 text-neutral-400" />
      )}
      {isFileOp && path ? <span>{path}</span> : <span>{toolName}</span>}
      {message.content && !path && (
        <span className="text-neutral-400 font-sans">— {message.content}</span>
      )}
    </span>
  );
}

export function AgentActivityFeed({ agentMessages, isRunning }: AgentActivityFeedProps) {
  // Group consecutive messages by agent for a cleaner display
  const groups: { agent: AgentRoleType; messages: AgentMessage[] }[] = [];

  for (const msg of agentMessages) {
    const last = groups[groups.length - 1];
    if (last && last.agent === msg.agent) {
      last.messages.push(msg);
    } else {
      groups.push({ agent: msg.agent, messages: [msg] });
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium uppercase tracking-wide">
        {isRunning ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        )}
        Multi-Agent Workflow
      </div>

      <div className="space-y-2">
        {groups.map((group, groupIndex) => {
          const info = AGENT_REGISTRY[group.agent];
          const isLast = groupIndex === groups.length - 1;
          const hasContent = group.messages.some((m) => m.content.trim());

          return (
            <div
              key={groupIndex}
              className="relative pl-4 border-l-2 py-2"
              style={{ borderColor: info?.color || "#9CA3AF" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <AgentBadge agent={group.agent} />
                {isLast && isRunning && (
                  <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                )}
                {!isRunning && isLast && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </div>

              {hasContent && (
                <div className="space-y-1">
                  {group.messages.map((msg) => {
                    if (!msg.content.trim()) return null;

                    // Skip workflow_done content (it's JSON data)
                    if (msg.type === "workflow_done") {
                      return (
                        <div key={msg.id} className="text-xs text-emerald-600 font-medium">
                          Workflow completed
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className="text-sm text-neutral-700 leading-relaxed">
                        {msg.type === "agent_start" && (
                          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                            <PlayCircle className="w-3 h-3" />
                            {msg.content}
                          </span>
                        )}
                        {msg.type === "agent_message" && (
                          <p className="text-sm text-neutral-700 whitespace-pre-wrap line-clamp-4">
                            {msg.content.slice(0, 500)}
                            {msg.content.length > 500 ? "..." : ""}
                          </p>
                        )}
                        {msg.type === "agent_tool_call" && <ToolCallPill message={msg} />}
                        {msg.type === "agent_done" && (
                          <span className="text-xs text-emerald-600 font-medium">
                            {msg.content}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
