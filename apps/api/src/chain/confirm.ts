/**
 * Deposit confirmation watcher.
 *
 * Participants report a txHash via POST /pay; this loop fetches each
 * receipt and confirms the payment only when the transaction is a real
 * deposit into the escrow:
 *
 *   - receipt.status == success
 *   - receipt.to == escrow address
 *   - receipt.from == the participant's wallet
 *   - calldata decodes to deposit(splitId, amount) for this split/share
 *
 * Calldata decoding keeps the loop independent of contract events (the
 * frozen interface has none) and makes it safe against a participant
 * submitting someone else's transaction hash.
 */

import { getTransaction, getTransactionReceipt } from "viem/actions";
import { decodeFunctionData } from "viem/utils";
import { getConfig } from "../config.js";
import { getPublicClient } from "./client.js";
import { escrowAbi } from "./escrowAbi.js";
import { amountToUnits } from "./units.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";
import { startWatcher } from "./watcher.js";

async function confirmPendingPayment(
  participantId: string,
  splitId: bigint,
  txHash: string,
  expectedFrom: string,
  expectedAmount: string,
): Promise<void> {
  const publicClient = getPublicClient();
  const config = getConfig();

  let receipt;
  let tx;
  try {
    receipt = await getTransactionReceipt(publicClient, { hash: txHash as `0x${string}` });
    tx = await getTransaction(publicClient, { hash: txHash as `0x${string}` });
  } catch {
    // Not mined (or unknown yet) — leave pending for the next tick.
    return;
  }

  // Reverted or mined but not a deposit into the escrow: clear the txHash
  // so the participant can retry.
  const valid =
    receipt.status === "success" &&
    receipt.to?.toLowerCase() === config.ESCROW_ADDRESS &&
    receipt.from.toLowerCase() === expectedFrom.toLowerCase();

  let amountMatches = false;
  if (valid && tx.input && tx.input !== "0x") {
    try {
      const decoded = decodeFunctionData({ abi: escrowAbi, data: tx.input as `0x${string}` });
      if (decoded.functionName === "deposit") {
        const [argSplitId, argAmount] = decoded.args;
        amountMatches =
          argSplitId === splitId && argAmount === amountToUnits(expectedAmount);
      }
    } catch {
      // Undecodable input — treat as invalid deposit.
    }
  }

  if (!valid || !amountMatches) {
    logger.warn(
      { participantId, txHash },
      "payment tx invalid — clearing for retry",
    );
    await prisma.splitParticipant.update({
      where: { id: participantId },
      data: { txHash: null },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const participant = await tx.splitParticipant.update({
      where: { id: participantId },
      data: { paid: true, confirmedAt: new Date() },
    });
    // Promote the split out of PENDING on the first confirmed payment.
    const split = await tx.split.findUnique({ where: { id: splitId } });
    if (split && split.status === "PENDING") {
      await tx.split.update({
        where: { id: splitId },
        data: { status: "PARTIALLY_PAID" },
      });
    }
    return participant;
  });

  logger.info({ participantId, splitId: splitId.toString(), txHash }, "payment confirmed");
}

export async function confirmTick(): Promise<void> {
  const pending = await prisma.splitParticipant.findMany({
    where: { txHash: { not: null }, paid: false },
    include: { user: true },
  });

  for (const row of pending) {
    if (!row.txHash) continue;
    await confirmPendingPayment(
      row.id,
      row.splitId,
      row.txHash,
      row.user.walletAddress ?? "",
      row.shareAmount.toFixed(),
    );
  }
}

export function startConfirmWatcher() {
  const { CONFIRM_INTERVAL_MS } = getConfig();
  return startWatcher("confirm", CONFIRM_INTERVAL_MS, confirmTick);
}
