import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { update: vi.fn() } },
}));

describe("renameProject", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("updates project name for authorized user", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { renameProject } = await import("../rename-project");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.update).mockResolvedValue({
      id: "proj-1",
      name: "My Component",
    } as any);

    const result = await renameProject("proj-1", "My Component");

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "proj-1" },
      data: { name: "My Component" },
    });
    expect(result.name).toBe("My Component");
  });

  test("throws Unauthorized when no session", async () => {
    const { getSession } = await import("@/lib/auth");
    await import("@/lib/prisma");
    const { renameProject } = await import("../rename-project");

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(renameProject("proj-1", "New Name")).rejects.toThrow("Unauthorized");
  });
});
