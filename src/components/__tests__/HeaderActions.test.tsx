import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderActions } from "../HeaderActions";

// jsdom doesn't include ResizeObserver; Radix Popover needs it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom doesn't implement scrollIntoView; Radix Command needs it
Element.prototype.scrollIntoView = () => {};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/actions/get-projects", () => ({ getProjects: vi.fn().mockResolvedValue([]) }));
vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn().mockResolvedValue({ id: "new-proj" }),
}));
vi.mock("@/actions/rename-project", () => ({ renameProject: vi.fn().mockResolvedValue({}) }));
vi.mock("@/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/components/auth/AuthDialog", () => ({ AuthDialog: () => null }));

const user = { id: "u1", email: "a@b.com" };
const projects = [
  { id: "p1", name: "Existing Project", createdAt: new Date(), updatedAt: new Date() },
];

describe("HeaderActions — new project name prompt", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  test("shows name input dialog when New Design is clicked", async () => {
    render(<HeaderActions user={user} projectId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: /new design/i }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByPlaceholderText(/project name/i)).toBeDefined();
  });

  test("calls createProject with user-entered name on confirm", async () => {
    const { createProject } = await import("@/actions/create-project");
    render(<HeaderActions user={user} projectId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: /new design/i }));

    const input = screen.getByPlaceholderText(/project name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "My Button");

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My Button" })
      );
    });
  });

  test("does not call createProject when dialog is cancelled", async () => {
    const { createProject } = await import("@/actions/create-project");
    render(<HeaderActions user={user} projectId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: /new design/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(createProject).not.toHaveBeenCalled();
  });
});

describe("HeaderActions — rename project", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getProjects } = await import("@/actions/get-projects");
    vi.mocked(getProjects).mockResolvedValue(projects);
  });
  afterEach(() => cleanup());

  test("shows rename dialog when pencil icon is clicked", async () => {
    render(<HeaderActions user={user} projectId="p1" />);

    // open project switcher (wait for loading to finish)
    await waitFor(() => screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("combobox"));

    // click rename button for the project
    await waitFor(() => screen.getByRole("button", { name: /rename existing project/i }));
    await userEvent.click(screen.getByRole("button", { name: /rename existing project/i }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByPlaceholderText(/project name/i)).toBeDefined();
  });

  test("calls renameProject with new name on confirm", async () => {
    const { renameProject } = await import("@/actions/rename-project");
    render(<HeaderActions user={user} projectId="p1" />);

    await waitFor(() => screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("combobox"));

    await waitFor(() => screen.getByRole("button", { name: /rename existing project/i }));
    await userEvent.click(screen.getByRole("button", { name: /rename existing project/i }));

    const input = screen.getByPlaceholderText(/project name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed Project");

    await userEvent.click(screen.getByRole("button", { name: /^rename$/i }));

    await waitFor(() => {
      expect(renameProject).toHaveBeenCalledWith("p1", "Renamed Project");
    });
  });
});
