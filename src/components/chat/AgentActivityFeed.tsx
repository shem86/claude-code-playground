"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, PlayCircle, FileCode2, Wrench, ChevronRight } from "lucide-react";
import { AgentBadge } from "./AgentBadge";
import { AGENT_REGISTRY, AgentRole, type AgentRoleType } from "@/lib/agents/types";
import type { AgentMessage } from "@/lib/contexts/chat-context";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

type AgentSummary = { text: string; verdict?: "approved" | "revision" };

/** Extract first sentence(s) up to `limit` chars. Reads past short (<=20 char) opening sentences. */
function extractFirstSentence(text: string, limit = 120): string {
  const flat = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;

  let end = 0;
  const re = /[.!?]\s+(?=[A-Z])/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(flat)) !== null) {
    const candidate = match.index + 1;
    if (end === 0 && candidate <= 20) {
      end = candidate;
      continue;
    }
    end = candidate;
    if (end >= 40) break;
  }

  if (end > 0 && end <= limit) return flat.slice(0, end).trim();
  return flat.slice(0, limit).trim() + "\u2026";
}

/** Detect QA verdict from both mock and real LLM output. */
function detectQAVerdict(noCode: string): AgentSummary | null {
  const verdictMatch = noCode.match(/\*\*Verdict:\s*([^*\n]+)\*\*/i);
  if (verdictMatch) {
    const verdict = verdictMatch[1].trim();
    return { text: verdict, verdict: /approved/i.test(verdict) ? "approved" : "revision" };
  }

  const revisionPatterns = [
    /(\d+)\s*critical\s*issues?/i,
    /flagged\s*for\s*revision/i,
    /needs?\s*revision/i,
    /sending\s*back\s*to\s*engineer/i,
    /revision\s*needed/i,
  ];
  for (const pat of revisionPatterns) {
    const m = noCode.match(pat);
    if (m) {
      const countMatch = noCode.match(/(\d+)\s*critical\s*issues?/i);
      const detail = countMatch ? `Revision needed \u2014 ${countMatch[1]} critical issues` : "Revision needed";
      return { text: detail, verdict: "revision" };
    }
  }

  const approvalPatterns = [
    /all\s*checks?\s*passed/i,
    /code\s*approved/i,
    /no\s*(?:critical\s*)?issues?\s*found/i,
    /approved?\s*(?:for\s*)?(?:production|release|delivery)/i,
    /passes?\s*all\s*(?:qa\s*)?checks/i,
  ];
  for (const pat of approvalPatterns) {
    if (pat.test(noCode)) {
      return { text: "Approved", verdict: "approved" };
    }
  }

  return null;
}

/** Produce a single summary line for a group of agent messages. */
function summarizeGroup(messages: AgentMessage[], agent: AgentRoleType): AgentSummary {
  // QA: try verdict detection across all messages
  if (agent === AgentRole.QA) {
    const allText = messages
      .filter((m) => m.type === "agent_message" && m.content.trim())
      .map((m) => m.content.replace(/```[\s\S]*?```/g, "").trim())
      .join("\n");
    const verdict = detectQAVerdict(allText);
    if (verdict) return verdict;
  }

  // Engineer: count file edits
  if (agent === AgentRole.ENGINEER) {
    const toolCalls = messages.filter((m) => m.type === "agent_tool_call");
    const filePaths = new Set(
      toolCalls
        .filter((m) => m.toolName === "str_replace_editor" || m.toolName === "file_manager")
        .map((m) => m.toolArgs?.path)
        .filter(Boolean)
    );
    if (filePaths.size === 1) {
      return { text: `Edited ${[...filePaths][0]}` };
    }
    if (filePaths.size > 1) {
      return { text: `Edited ${filePaths.size} files` };
    }
  }

  // Fallback: first sentence of first meaningful text message
  const firstText = messages.find((m) => m.type === "agent_message" && m.content.trim());
  if (firstText) {
    const noCode = firstText.content.replace(/```[\s\S]*?```/g, "").trim();
    if (noCode) return { text: extractFirstSentence(noCode) };
  }

  const count = messages.filter((m) => m.content.trim()).length;
  return { text: `${count} message${count !== 1 ? "s" : ""}` };
}

function ToolCallPill({ message }: { message: AgentMessage }) {
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
        <span className="text-neutral-400 font-sans">&mdash; {message.content}</span>
      )}
    </span>
  );
}

interface AgentGroupProps {
  group: { agent: AgentRoleType; messages: AgentMessage[] };
  isLast: boolean;
  isRunning: boolean;
}

function AgentGroup({ group, isLast, isRunning }: AgentGroupProps) {
  const info = AGENT_REGISTRY[group.agent];
  const summary = summarizeGroup(group.messages, group.agent);
  const hasContent = group.messages.some((m) => m.content.trim());

  const [open, setOpen] = useState(isLast && isRunning);

  useEffect(() => {
    if (isLast && isRunning) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [isLast, isRunning]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
      <div
        className="relative pl-4 border-l-2 py-1"
        style={{ borderColor: info?.color || "#9CA3AF" }}
      >
        <CollapsibleTrigger className="flex flex-col gap-1 w-full min-w-0 text-left cursor-pointer group py-1">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
            <AgentBadge agent={group.agent} />
            <span className="ml-auto flex items-center shrink-0">
              {isLast && isRunning && (
                <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
              )}
              {!isRunning && isLast && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
            </span>
          </div>
          <span className="text-xs text-neutral-500 line-clamp-2 ml-5 group-data-[state=open]:hidden">
            {summary.verdict === "approved" ? (
              <span className="text-emerald-600 font-medium">{summary.text}</span>
            ) : summary.verdict === "revision" ? (
              <span className="text-amber-600 font-medium">{summary.text}</span>
            ) : (
              summary.text
            )}
          </span>
        </CollapsibleTrigger>

        {hasContent && (
          <CollapsibleContent>
            <div className="space-y-1 mt-1 ml-5">
              {group.messages.map((msg) => {
                if (!msg.content.trim()) return null;

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
                      <p className="text-sm text-neutral-600 whitespace-pre-wrap break-words">
                        {msg.content}
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
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

interface AgentActivityFeedProps {
  agentMessages: AgentMessage[];
  isRunning: boolean;
}

export function AgentActivityFeed({ agentMessages, isRunning }: AgentActivityFeedProps) {
  // Group consecutive messages by agent
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

      <div className="space-y-1">
        {groups.map((group, groupIndex) => (
          <AgentGroup
            key={groupIndex}
            group={group}
            isLast={groupIndex === groups.length - 1}
            isRunning={isRunning}
          />
        ))}
      </div>
    </div>
  );
}
