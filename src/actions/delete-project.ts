"use server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function deleteProject(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return prisma.project.delete({ where: { id: projectId } });
}
