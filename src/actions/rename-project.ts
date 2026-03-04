"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function renameProject(projectId: string, name: string) {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return prisma.project.update({
    where: { id: projectId },
    data: { name },
  });
}
