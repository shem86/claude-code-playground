import { describe, test, expect, vi, beforeEach } from "vitest";
import { saveProjectState } from "../save-project";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { AgentMessage } from "../types";
import { AgentRole } from "../types";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

const mockSession = { userId: "user-1" };

function makeAgentMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: "agent-1",
    agent: AgentRole.DESIGN,
    type: "agent_message",
    content: "Design spec ready",
    timestamp: 1000,
    ...overrides,
  };
}

describe("saveProjectState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.project.update).mockResolvedValue({} as any);
  });

  test("saves messages and file data without agent events (backward compatible)", async () => {
    const messages = [{ id: "1", role: "user", content: "hello" }];
    const fileData = { "/": { type: "directory" } };

    await saveProjectState("proj-1", messages, fileData as any);

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "proj-1", userId: "user-1" },
      data: {
        messages: JSON.stringify(messages),
        data: JSON.stringify(fileData),
      },
    });
  });

  test("appends agent events as a new run when newAgentRun is provided", async () => {
    const agentRun = [
      makeAgentMessage({ id: "a1", agent: AgentRole.DESIGN }),
      makeAgentMessage({ id: "a2", agent: AgentRole.ENGINEER }),
    ];

    // Simulate existing agentEvents in DB (one prior run)
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      agentEvents: JSON.stringify([[makeAgentMessage({ id: "old" })]]),
    } as any);

    await saveProjectState("proj-1", [], {} as any, agentRun);

    const updateCall = vi.mocked(prisma.project.update).mock.calls[0][0];
    const savedAgentEvents = JSON.parse(updateCall.data.agentEvents as string);

    // Should have 2 runs: the old one + the new one
    expect(savedAgentEvents).toHaveLength(2);
    expect(savedAgentEvents[0]).toHaveLength(1); // old run
    expect(savedAgentEvents[0][0].id).toBe("old");
    expect(savedAgentEvents[1]).toHaveLength(2); // new run
    expect(savedAgentEvents[1][0].id).toBe("a1");
    expect(savedAgentEvents[1][1].id).toBe("a2");
  });

  test("creates first run when no prior agentEvents exist", async () => {
    const agentRun = [makeAgentMessage({ id: "first" })];

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      agentEvents: "[]",
    } as any);

    await saveProjectState("proj-1", [], {} as any, agentRun);

    const updateCall = vi.mocked(prisma.project.update).mock.calls[0][0];
    const savedAgentEvents = JSON.parse(updateCall.data.agentEvents as string);

    expect(savedAgentEvents).toHaveLength(1);
    expect(savedAgentEvents[0][0].id).toBe("first");
  });

  test("does not save agentEvents when newAgentRun is empty", async () => {
    await saveProjectState("proj-1", [], {} as any, []);

    expect(prisma.project.findUnique).not.toHaveBeenCalled();

    const updateCall = vi.mocked(prisma.project.update).mock.calls[0][0];
    expect(updateCall.data.agentEvents).toBeUndefined();
  });

  test("does not save agentEvents when newAgentRun is undefined", async () => {
    await saveProjectState("proj-1", [], {} as any);

    expect(prisma.project.findUnique).not.toHaveBeenCalled();

    const updateCall = vi.mocked(prisma.project.update).mock.calls[0][0];
    expect(updateCall.data.agentEvents).toBeUndefined();
  });

  test("skips saving when user is not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);

    await saveProjectState("proj-1", [], {} as any, [makeAgentMessage()]);

    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
