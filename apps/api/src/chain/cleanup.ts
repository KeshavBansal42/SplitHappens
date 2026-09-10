import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import { startWatcher } from "./watcher.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Drops splits the creator never finished opening. They were never
 * registered on-chain, so nobody could have joined or paid them.
 */
export async function cleanupTick(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_AGE_MS);

  const stale = await prisma.split.findMany({
    where: { openedAt: null, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const split of stale) {
    await prisma.$transaction([
      prisma.splitInvite.deleteMany({ where: { splitId: split.id } }),
      prisma.splitParticipant.deleteMany({ where: { splitId: split.id } }),
      prisma.split.delete({ where: { id: split.id } }),
    ]);
    logger.info({ splitId: split.id.toString() }, "removed unopened split");
  }
}

export function startCleanupWatcher() {
  const { WATCH_INTERVAL_MS } = getConfig();
  return startWatcher("cleanup", WATCH_INTERVAL_MS, cleanupTick);
}
