import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function saveProjectState(
  projectId: string,
  messages: any[],
  fileSystemData: Record<string, any>
): Promise<void> {
  try {
    const session = await getSession();
    if (!session) {
      console.error("User not authenticated, cannot save project");
      return;
    }

    await prisma.project.update({
      where: { id: projectId, userId: session.userId },
      data: {
        messages: JSON.stringify(messages),
        data: JSON.stringify(fileSystemData),
      },
    });
  } catch (error) {
    console.error("Failed to save project data:", error);
  }
}
