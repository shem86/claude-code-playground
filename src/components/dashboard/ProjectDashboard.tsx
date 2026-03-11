"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, LogOut, ChevronRight, Pencil, Trash2, GitBranch, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { createProject } from "@/actions/create-project";
import { renameProject } from "@/actions/rename-project";
import { deleteProject } from "@/actions/delete-project";
import { signOut } from "@/actions";

interface ProjectDashboardProps {
  projects: { id: string; name: string; updatedAt: Date; usedSupervisor: boolean }[];
  userEmail: string;
}

function relativeTime(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  const m = Math.floor(diffDays / 30);
  return `${m} month${m > 1 ? "s" : ""} ago`;
}

const PALETTES = [
  { bg: "bg-violet-100",  text: "text-violet-600"  },
  { bg: "bg-sky-100",     text: "text-sky-700"     },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100",   text: "text-amber-700"   },
  { bg: "bg-rose-100",    text: "text-rose-600"    },
  { bg: "bg-indigo-100",  text: "text-indigo-600"  },
  { bg: "bg-teal-100",    text: "text-teal-700"    },
  { bg: "bg-orange-100",  text: "text-orange-700"  },
];

function getProjectAccent(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

export function ProjectDashboard({ projects: initialProjects, userEmail }: ProjectDashboardProps) {
  const router = useRouter();
  const [localProjects, setLocalProjects] = useState(initialProjects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingProject, setRenamingProject] = useState<{ id: string; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<{ id: string; name: string } | null>(null);

  const handleNewProject = () => {
    setProjectName("");
    setDialogOpen(true);
  };

  const handleRenameClick = (project: { id: string; name: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingProject(project);
    setRenameName(project.name);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!renamingProject) return;
    const name = renameName.trim() || renamingProject.name;
    await renameProject(renamingProject.id, name);
    setLocalProjects((prev) => prev.map((p) => (p.id === renamingProject.id ? { ...p, name } : p)));
    setRenameDialogOpen(false);
  };

  const handleDeleteClick = (project: { id: string; name: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingProject(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
    setLocalProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
    setDeleteDialogOpen(false);
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      const name = projectName.trim() || `Design #${~~(Math.random() * 100000)}`;
      const project = await createProject({ name, messages: [], data: {} });
      setDialogOpen(false);
      router.push(`/${project.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg hover:opacity-75 transition-opacity">
          CrewUI
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{userEmail}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => signOut()} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Projects</h1>
          <Button onClick={handleNewProject} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {localProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-lg font-medium">No projects yet</p>
              <p className="text-muted-foreground text-sm mt-1">Get started by creating your first project</p>
            </div>
            <Button onClick={handleNewProject} className="gap-2 mt-2">
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Project cards */}
            {localProjects.map((project) => {
              const accent = getProjectAccent(project.id);
              return (
                <div key={project.id} className="relative group pt-8">
                  {/* Folder tabs — hidden behind card at rest, slide up on hover */}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 z-0
                                  flex transition-transform duration-200 ease-out
                                  group-hover:-translate-y-full">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5
                                 bg-card border border-b-0 border-border rounded-tl-lg
                                 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                      aria-label={`Rename ${project.name}`}
                      onClick={(e) => handleRenameClick(project, e)}>
                      <Pencil className="h-3 w-3" />
                      <span>Rename</span>
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5
                                 bg-card border border-b-0 border-l-0 border-border rounded-tr-lg
                                 text-xs text-muted-foreground hover:text-destructive whitespace-nowrap"
                      aria-label={`Delete ${project.name}`}
                      onClick={(e) => handleDeleteClick(project, e)}>
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Card — z-10 covers the tab at rest */}
                  <div
                    onClick={() => router.push(`/${project.id}`)}
                    className="relative z-10 bg-card border border-border rounded-xl shadow-sm flex flex-col h-[160px] p-5 cursor-pointer group transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-base text-foreground leading-snug line-clamp-2 flex-1">
                        {project.name}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                project.usedSupervisor
                                  ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                              }`}
                              aria-label={project.usedSupervisor ? "Supervisor mode" : "Pipeline mode"}
                            >
                              {project.usedSupervisor
                                ? <Workflow className="h-3.5 w-3.5" />
                                : <GitBranch className="h-3.5 w-3.5" />
                              }
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="top"
                            className="w-56 p-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              {project.usedSupervisor
                                ? <Workflow className="h-3.5 w-3.5 text-amber-600" />
                                : <GitBranch className="h-3.5 w-3.5 text-neutral-500" />
                              }
                              <span className="text-sm font-medium">
                                {project.usedSupervisor ? "Supervisor" : "Pipeline"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {project.usedSupervisor
                                ? "AI supervisor analyzed each request and picked the optimal agent route."
                                : "Agents ran in a fixed sequence: Design \u2192 Engineer \u2192 QA."
                              }
                            </p>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{relativeTime(new Date(project.updatedAt))}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New Project card */}
            <button
              onClick={handleNewProject}
              className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 h-[160px] w-full cursor-pointer group transition-all duration-200 hover:border-foreground/30 hover:bg-accent/50 text-muted-foreground hover:text-foreground">
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-current flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">New Project</span>
            </button>
          </div>
        )}
      </main>

      {/* New project dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isCreating && handleCreateProject()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">&ldquo;{deletingProject?.name}&rdquo;</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Project name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
