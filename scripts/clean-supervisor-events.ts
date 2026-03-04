import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const BAD_CONTENT_PREFIXES = [
  "Starting multi-agent workflow...",
  "Starting multi-agent workflow — this is a mock demo",
];

function isBadOrchestratorMessage(msg: unknown): boolean {
  if (!msg || typeof msg !== "object") return false;
  const { agent, type, content } = msg as Record<string, string>;
  return (
    agent === "orchestrator" &&
    type === "agent_start" &&
    BAD_CONTENT_PREFIXES.some((prefix) => content?.startsWith(prefix))
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[DRY RUN] No changes will be written.\n");

  const projects = await prisma.project.findMany({
    select: { id: true, agentEvents: true },
  });

  console.log(`Found ${projects.length} project(s) to inspect.\n`);

  let totalRemoved = 0;

  for (const project of projects) {
    let runs: unknown[][];
    try {
      runs = JSON.parse(project.agentEvents);
      if (!Array.isArray(runs)) continue;
    } catch {
      console.warn(`  Project ${project.id}: malformed agentEvents JSON, skipping.`);
      continue;
    }

    const cleaned = runs.map((run) =>
      Array.isArray(run) ? run.filter((msg) => !isBadOrchestratorMessage(msg)) : run
    );
    const removed = runs.reduce(
      (sum, run, i) =>
        sum + (Array.isArray(run) ? run.length - (cleaned[i] as unknown[]).length : 0),
      0
    );

    if (removed > 0) {
      console.log(`  Project ${project.id}: removing ${removed} bad orchestrator message(s)`);
      totalRemoved += removed;
      if (!dryRun) {
        await prisma.project.update({
          where: { id: project.id },
          data: { agentEvents: JSON.stringify(cleaned) },
        });
      }
    }
  }

  console.log(`\nDone. Total messages ${dryRun ? "would be " : ""}removed: ${totalRemoved}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
