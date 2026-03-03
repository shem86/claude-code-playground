import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { AgentMessage } from "./types";

export async function saveProjectState(
  projectId: string,
  messages: any[],
  fileSystemData: Record<string, any>,
  newAgentRun?: AgentMessage[]
): Promise<void> {
  try {
    const session = await getSession();
    if (!session) {
      console.error("User not authenticated, cannot save project");
      return;
    }

    const updateData: Record<string, string> = {
      messages: JSON.stringify(messages),
      data: JSON.stringify(fileSystemData),
    };

    if (newAgentRun && newAgentRun.length > 0) {
      const existing = await prisma.project.findUnique({
        where: { id: projectId, userId: session.userId },
        select: { agentEvents: true },
      });
      const runs: AgentMessage[][] = existing?.agentEvents
        ? JSON.parse(existing.agentEvents)
        : [];
      runs.push(newAgentRun);
      updateData.agentEvents = JSON.stringify(runs);
    }

    await prisma.project.update({
      where: { id: projectId, userId: session.userId },
      data: updateData,
    });
  } catch (error) {
    console.error("Failed to save project data:", error);
  }
}
