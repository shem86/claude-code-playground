import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { delete: vi.fn() } },
}));

describe("deleteProject", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("throws Unauthorized when no session", async () => {
    const { getSession } = await import("@/lib/auth");
    const { deleteProject } = await import("../delete-project");

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(deleteProject("proj-1")).rejects.toThrow("Unauthorized");
  });

  test("calls prisma.project.delete with the project id when authorized", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { deleteProject } = await import("../delete-project");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.delete).mockResolvedValue({ id: "proj-1" } as any);

    await deleteProject("proj-1");

    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: "proj-1" } });
  });
});
