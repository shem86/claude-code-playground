import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { create: vi.fn() } },
}));

describe("createProject", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("throws Unauthorized when no session", async () => {
    const { getSession } = await import("@/lib/auth");
    const { createProject } = await import("../create-project");

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(createProject({ name: "Test", messages: [], data: {} })).rejects.toThrow(
      "Unauthorized"
    );
  });

  test("calls prisma.project.create with stringified messages and data", async () => {
    const { getSession } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    const { createProject } = await import("../create-project");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1" } as any);
    vi.mocked(prisma.project.create).mockResolvedValue({
      id: "proj-new",
      name: "Test Project",
    } as any);

    const result = await createProject({ name: "Test Project", messages: [], data: {} });

    expect(prisma.project.create).toHaveBeenCalledWith({
      data: {
        name: "Test Project",
        userId: "user-1",
        messages: "[]",
        data: "{}",
      },
    });
    expect(result).toEqual({ id: "proj-new", name: "Test Project" });
  });
});
