"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getProjects() {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const projects = await prisma.project.findMany({
    where: {
      userId: session.userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      agentEvents: true,
    },
  });

  return projects.map(({ agentEvents, ...project }) => {
    let usedSupervisor = false;
    try {
      const runs: { agent: string }[][] = JSON.parse(agentEvents);
      usedSupervisor = runs.some((run) =>
        run.some((event) => event.agent === "orchestrator")
      );
    } catch {
      // invalid JSON — treat as no supervisor
    }
    return { ...project, usedSupervisor };
  });
}
