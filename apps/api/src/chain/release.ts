/**
 * Release watcher.
 *
 * For every split that is not released, polls the escrow's getSplitStatus:
 *
 *   - released == true  -> someone already released it (release is
 *     permissionless); mirror that into the db.
 *   - collected >= target -> the escrow is fully funded; send release()
 *     from the backend wallet and mark the split released on success.
 *
 * The contract enforces release-once, and the db status flag guards the
 * watcher from re-attempting, so this loop is idempotent by construction.
 */

import { getTransactionReceipt, readContract, writeContract } from "viem/actions";
import { getConfig } from "../config.js";
import { getPublicClient, getReleaserAccount, getWalletClient } from "./client.js";
import { escrowAbi } from "./escrowAbi.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { startWatcher } from "./watcher.js";

export async function releaseTick(): Promise<void> {
  const config = getConfig();
  const splits = await prisma.split.findMany({
    where: { status: { not: "RELEASED" } },
  });

  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const escrow = config.ESCROW_ADDRESS as `0x${string}`;

  for (const split of splits) {
    let status;
    try {
      const [collected, target, released] = await readContract(publicClient, {
        address: escrow,
        abi: escrowAbi,
        functionName: "getSplitStatus",
        args: [split.id],
      });
      status = { collected, target, released };
    } catch (err) {
      // RPC hiccup — try again next tick.
      logger.warn({ err, splitId: split.id.toString() }, "release watcher read failed");
      continue;
    }

    if (status.released) {
      logger.info({ splitId: split.id.toString() }, "split released on-chain");
      await prisma.split.update({
        where: { id: split.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      continue;
    }

    if (status.collected >= status.target) {
      const hash = await writeContract(walletClient, {
        address: escrow,
        abi: escrowAbi,
        functionName: "release",
        args: [split.id],
        account: getReleaserAccount(),
        chain: walletClient.chain,
      });
      const receipt = await getTransactionReceipt(publicClient, { hash });
      if (receipt.status === "success") {
        await prisma.split.update({
          where: { id: split.id },
          data: {
            status: "RELEASED",
            releaseTxHash: hash,
            releasedAt: new Date(),
          },
        });
        logger.info(
          { splitId: split.id.toString(), releaseTxHash: hash },
          "split released",
        );
      } else {
        logger.warn(
          { splitId: split.id.toString(), releaseTxHash: hash },
          "release transaction reverted",
        );
      }
    }
  }
}

export function startReleaseWatcher() {
  const { WATCH_INTERVAL_MS } = getConfig();
  return startWatcher("release", WATCH_INTERVAL_MS, releaseTick);
}
