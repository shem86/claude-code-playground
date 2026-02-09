// Client-safe types — no LangGraph/LangChain imports here.
// LangGraph state annotations are defined in graph.ts (server-only).

export const AgentRole = {
  DESIGN: "design",
  ENGINEER: "engineer",
  QA: "qa",
  ORCHESTRATOR: "orchestrator",
} as const;

export type AgentRoleType = (typeof AgentRole)[keyof typeof AgentRole];

export interface AgentInfo {
  role: AgentRoleType;
  name: string;
  company: string;
  color: string;
  description: string;
}

export const AGENT_REGISTRY: Record<AgentRoleType, AgentInfo> = {
  [AgentRole.DESIGN]: {
    role: AgentRole.DESIGN,
    name: "Design Agent",
    company: "DesignCo",
    color: "#8B5CF6", // purple
    description: "Plans component structure, props, state, color palettes, and layout",
  },
  [AgentRole.ENGINEER]: {
    role: AgentRole.ENGINEER,
    name: "Engineer Agent",
    company: "EngineerCo",
    color: "#2563EB", // blue
    description: "Writes React + Tailwind code based on design specifications",
  },
  [AgentRole.QA]: {
    role: AgentRole.QA,
    name: "QA Agent",
    company: "QACo",
    color: "#059669", // green
    description: "Reviews code for bugs, accessibility, and best practices",
  },
  [AgentRole.ORCHESTRATOR]: {
    role: AgentRole.ORCHESTRATOR,
    name: "Orchestrator",
    company: "Supervisor",
    color: "#DC2626", // red
    description: "Routes tasks between agents and decides when output is ready",
  },
};

// Streamed event from multi-agent workflow to the client
export interface AgentStreamEvent {
  type: "agent_start" | "agent_message" | "agent_tool_call" | "agent_done" | "workflow_done";
  agent: AgentRoleType;
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: string;
}
