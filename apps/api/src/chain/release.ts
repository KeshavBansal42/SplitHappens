import { readContract } from "viem/actions";
import { getConfig } from "../config.js";
import { getPublicClient } from "./client.js";
import { escrowAbi } from "./escrowAbi.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { startWatcher } from "./watcher.js";

/**
 * Read-only: mirrors the escrow's released flag into the db. Releasing is
 * triggered by a participant's wallet, not by the backend.
 */
export async function releaseTick(): Promise<void> {
  const config = getConfig();
  const splits = await prisma.split.findMany({
    where: { status: { not: "RELEASED" }, openedAt: { not: null } },
  });

  const publicClient = getPublicClient();
  const escrow = config.ESCROW_ADDRESS as `0x${string}`;

  for (const split of splits) {
    let released: boolean;
    try {
      [, , released] = await readContract(publicClient, {
        address: escrow,
        abi: escrowAbi,
        functionName: "getSplitStatus",
        args: [split.id],
      });
    } catch (err) {
      logger.warn({ err, splitId: split.id.toString() }, "release watcher read failed");
      continue;
    }

    if (released) {
      logger.info({ splitId: split.id.toString() }, "split released on-chain");
      await prisma.split.update({
        where: { id: split.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
    }
  }
}

export function startReleaseWatcher() {
  const { WATCH_INTERVAL_MS } = getConfig();
  return startWatcher("release", WATCH_INTERVAL_MS, releaseTick);
}
