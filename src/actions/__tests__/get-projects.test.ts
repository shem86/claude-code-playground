import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findMany: vi.fn() } },
}));

describe("getProjects", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("throws Unauthorized when no session", async () => {
    const { getSession } = await import("@/lib/auth");
    const { getProjects } = await import("../get-projects");

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(getProjects()).rejects.toThrow("Unauthorized");
  });

  test("returns usedSupervisor: true when any run contains an orchestrator event", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { getProjects } = await import("../get-projects");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      {
        id: "proj-1",
        name: "My Project",
        createdAt: new Date(),
        updatedAt: new Date(),
        agentEvents: JSON.stringify([[{ agent: "orchestrator" }, { agent: "engineer" }]]),
      },
    ] as any);

    const result = await getProjects();
    expect(result[0].usedSupervisor).toBe(true);
  });

  test("returns usedSupervisor: false when no orchestrator events", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { getProjects } = await import("../get-projects");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      {
        id: "proj-1",
        name: "My Project",
        createdAt: new Date(),
        updatedAt: new Date(),
        agentEvents: JSON.stringify([[{ agent: "design" }, { agent: "engineer" }]]),
      },
    ] as any);

    const result = await getProjects();
    expect(result[0].usedSupervisor).toBe(false);
  });

  test("returns usedSupervisor: false when agentEvents is invalid JSON", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { getProjects } = await import("../get-projects");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      {
        id: "proj-1",
        name: "My Project",
        createdAt: new Date(),
        updatedAt: new Date(),
        agentEvents: "not-valid-json",
      },
    ] as any);

    const result = await getProjects();
    expect(result[0].usedSupervisor).toBe(false);
  });

  test("returns usedSupervisor: false when agentEvents is empty runs", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { getProjects } = await import("../get-projects");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      {
        id: "proj-1",
        name: "My Project",
        createdAt: new Date(),
        updatedAt: new Date(),
        agentEvents: "[]",
      },
    ] as any);

    const result = await getProjects();
    expect(result[0].usedSupervisor).toBe(false);
  });
});
