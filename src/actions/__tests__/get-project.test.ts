import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getProject", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("returns parsed agentEvents from the project record", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { getProject } = await import("../get-project");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);

    const agentRuns = [
      [
        { id: "a1", agent: "design", type: "agent_start", content: "Starting", timestamp: 1000 },
        { id: "a2", agent: "engineer", type: "agent_message", content: "Code", timestamp: 2000 },
      ],
    ];

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "proj-1",
      name: "Test",
      messages: "[]",
      data: "{}",
      agentEvents: JSON.stringify(agentRuns),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
    } as any);

    const result = await getProject("proj-1");

    expect(result.agentEvents).toEqual(agentRuns);
    expect(result.agentEvents).toHaveLength(1);
    expect(result.agentEvents[0]).toHaveLength(2);
    expect(result.agentEvents[0][0].agent).toBe("design");
  });

  test("returns empty array when agentEvents column has default value", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { getProject } = await import("../get-project");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "proj-2",
      name: "Empty",
      messages: "[]",
      data: "{}",
      agentEvents: "[]",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
    } as any);

    const result = await getProject("proj-2");

    expect(result.agentEvents).toEqual([]);
  });
});
