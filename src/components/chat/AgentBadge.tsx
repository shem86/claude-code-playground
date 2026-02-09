"use client";

import { AGENT_REGISTRY, type AgentRoleType } from "@/lib/agents/types";

interface AgentBadgeProps {
  agent: AgentRoleType;
  size?: "sm" | "md";
}

export function AgentBadge({ agent, size = "sm" }: AgentBadgeProps) {
  const info = AGENT_REGISTRY[agent];
  if (!info) return null;

  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses}`}
      style={{
        backgroundColor: `${info.color}15`,
        color: info.color,
        border: `1px solid ${info.color}30`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info.color }} />
      {info.company}
    </span>
  );
}
