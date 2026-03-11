import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDashboard } from "../ProjectDashboard";

// jsdom doesn't include ResizeObserver; Radix Popover needs it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom doesn't implement scrollIntoView; Radix Command needs it
Element.prototype.scrollIntoView = () => {};

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn().mockResolvedValue({ id: "new-proj" }),
}));
vi.mock("@/actions/rename-project", () => ({
  renameProject: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/delete-project", () => ({
  deleteProject: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions", () => ({ signOut: vi.fn() }));

const baseProjects = [
  {
    id: "p1",
    name: "Alpha Project",
    updatedAt: new Date(),
    usedSupervisor: false,
  },
  {
    id: "p2",
    name: "Beta Project",
    updatedAt: new Date(Date.now() - 86400000), // yesterday
    usedSupervisor: true,
  },
];

describe("ProjectDashboard", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  test("renders empty state when projects is empty", () => {
    render(<ProjectDashboard projects={[]} userEmail="test@example.com" />);
    expect(screen.getByText("No projects yet")).toBeDefined();
  });

  test("renders project cards when projects exist", () => {
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);
    expect(screen.getByText("Alpha Project")).toBeDefined();
    expect(screen.getByText("Beta Project")).toBeDefined();
    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.getByText("Yesterday")).toBeDefined();
  });

  test("shows Supervisor mode button when usedSupervisor is true", () => {
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);
    expect(screen.getByRole("button", { name: "Supervisor mode" })).toBeDefined();
  });

  test("shows Pipeline mode button when usedSupervisor is false", () => {
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);
    expect(screen.getByRole("button", { name: "Pipeline mode" })).toBeDefined();
  });

  test("opens create-project dialog when New Project button is clicked", async () => {
    render(<ProjectDashboard projects={[]} userEmail="test@example.com" />);
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByPlaceholderText(/project name/i)).toBeDefined();
  });

  test("handleCreateProject: calls createProject and router.push", async () => {
    const { createProject } = await import("@/actions/create-project");
    render(<ProjectDashboard projects={[]} userEmail="test@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    const input = screen.getByPlaceholderText(/project name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "My New Project");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My New Project" })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-proj");
    });
  });

  test("handleRenameConfirm: calls renameProject and updates local state", async () => {
    const { renameProject } = await import("@/actions/rename-project");
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: /rename alpha project/i }));
    expect(screen.getByRole("dialog")).toBeDefined();

    const input = screen.getByPlaceholderText(/project name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed Alpha");
    await userEvent.click(screen.getByRole("button", { name: /^rename$/i }));

    await waitFor(() => {
      expect(renameProject).toHaveBeenCalledWith("p1", "Renamed Alpha");
    });
    expect(screen.getByText("Renamed Alpha")).toBeDefined();
  });

  test("handleDeleteConfirm: calls deleteProject and removes card from DOM", async () => {
    const { deleteProject } = await import("@/actions/delete-project");
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: /delete alpha project/i }));
    expect(screen.getByRole("dialog")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteProject).toHaveBeenCalledWith("p1");
    });
    expect(screen.queryByText("Alpha Project")).toBeNull();
  });

  test("cancel on create dialog does not call createProject", async () => {
    const { createProject } = await import("@/actions/create-project");
    render(<ProjectDashboard projects={[]} userEmail="test@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: /new project/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(createProject).not.toHaveBeenCalled();
  });

  test("cancel on delete dialog does not call deleteProject", async () => {
    const { deleteProject } = await import("@/actions/delete-project");
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: /delete alpha project/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(deleteProject).not.toHaveBeenCalled();
  });

  test("cancel on rename dialog does not call renameProject", async () => {
    const { renameProject } = await import("@/actions/rename-project");
    render(<ProjectDashboard projects={baseProjects} userEmail="test@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: /rename alpha project/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(renameProject).not.toHaveBeenCalled();
  });
});

describe("relativeTime util", () => {
  test("Today for same day", () => {
    render(<ProjectDashboard projects={[{ id: "x", name: "X", updatedAt: new Date(), usedSupervisor: false }]} userEmail="a@b.com" />);
    expect(screen.getByText("Today")).toBeDefined();
  });

  test("Yesterday for 1 day ago", () => {
    const d = new Date(Date.now() - 86400000);
    render(<ProjectDashboard projects={[{ id: "x", name: "X", updatedAt: d, usedSupervisor: false }]} userEmail="a@b.com" />);
    expect(screen.getByText("Yesterday")).toBeDefined();
  });

  test("X days ago for < 30 days", () => {
    const d = new Date(Date.now() - 5 * 86400000);
    render(<ProjectDashboard projects={[{ id: "x", name: "X", updatedAt: d, usedSupervisor: false }]} userEmail="a@b.com" />);
    expect(screen.getByText("5 days ago")).toBeDefined();
  });

  test("X months ago for >= 30 days", () => {
    const d = new Date(Date.now() - 60 * 86400000);
    render(<ProjectDashboard projects={[{ id: "x", name: "X", updatedAt: d, usedSupervisor: false }]} userEmail="a@b.com" />);
    expect(screen.getByText("2 months ago")).toBeDefined();
  });
});
