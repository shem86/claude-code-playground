"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createProject } from "@/actions/create-project";
import { signOut } from "@/actions";

interface ProjectDashboardProps {
  projects: { id: string; name: string; updatedAt: Date }[];
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

export function ProjectDashboard({ projects, userEmail }: ProjectDashboardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleNewProject = () => {
    setProjectName("");
    setDialogOpen(true);
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

        {projects.length === 0 ? (
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
            {projects.map((project) => {
              const accent = getProjectAccent(project.id);
              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/${project.id}`)}
                  className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-[160px] p-5 cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-base text-foreground leading-snug line-clamp-2 flex-1">
                      {project.name}
                    </p>
                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold select-none ${accent.bg} ${accent.text}`}>
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{relativeTime(new Date(project.updatedAt))}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
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
    </div>
  );
}
