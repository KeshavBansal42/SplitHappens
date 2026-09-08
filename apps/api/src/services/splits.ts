/**
 * Split business logic shared by the HTTP routes and the chain watchers.
 */

import { Prisma } from "@prisma/client";
import { ApiError } from "../errors.js";
import { prisma } from "../db.js";
import {
  amountToUnits,
  decimalToUnits,
} from "../chain/units.js";

export const splitWithParticipants = Prisma.validator<Prisma.SplitDefaultArgs>()({
  include: {
    participants: { include: { user: true } },
  },
});

export type SplitWithParticipants = Prisma.SplitGetPayload<typeof splitWithParticipants>;

/** Fetch a split by id with its participants, or throw NOT_FOUND. */
export async function getSplitOrThrow(id: bigint): Promise<SplitWithParticipants> {
  const split = await prisma.split.findUnique({
    where: { id },
    include: splitWithParticipants.include,
  });
  if (!split) {
    throw new ApiError("NOT_FOUND", `Split ${id.toString()} not found`);
  }
  return split;
}

/**
 * Adds the caller as a participant.
 *
 * Rejects when the split is released, when the caller already joined, or
 * when the new share would push the sum of shares over the split total.
 * The share's token-unit precision is checked up front so the sum cannot
 * drift into float territory.
 */
export async function joinSplit(splitId: bigint, userId: string, shareAmount: string): Promise<void> {
  const split = await getSplitOrThrow(splitId);

  if (split.status === "RELEASED") {
    throw new ApiError("CONFLICT", "Split is already released");
  }

  const existing = await prisma.splitParticipant.findUnique({
    where: { splitId_userId: { splitId, userId } },
  });
  if (existing) {
    throw new ApiError("CONFLICT", "You have already joined this split");
  }

  const newShare = new Prisma.Decimal(shareAmount);
  const newShareUnits = amountToUnits(shareAmount);

  const sumRow = await prisma.splitParticipant.aggregate({
    where: { splitId },
    _sum: { shareAmount: true },
  });
  const currentSumUnits = sumRow._sum.shareAmount
    ? decimalToUnits(sumRow._sum.shareAmount)
    : 0n;
  const totalUnits = decimalToUnits(split.totalAmount);

  if (currentSumUnits + newShareUnits > totalUnits) {
    throw new ApiError(
      "SHARE_OVERFLOW",
      "Joining would push the total of all shares above the split amount",
    );
  }

  await prisma.splitParticipant.create({
    data: { splitId, userId, shareAmount: newShare },
  });
}

/**
 * Records the caller's intent to pay: the wallet transaction was sent by
 * the client, and the confirmation watcher later verifies it on-chain.
 *
 * Validates that the caller is a participant, the amount matches their
 * share exactly, and they have not already paid (or have a tx pending).
 */
export async function paySplit(
  splitId: bigint,
  userId: string,
  txHash: string,
  amount: string,
) {
  const split = await getSplitOrThrow(splitId);

  if (split.status === "RELEASED") {
    throw new ApiError("CONFLICT", "Split is already released");
  }

  const participant = await prisma.splitParticipant.findUnique({
    where: { splitId_userId: { splitId, userId } },
    include: { user: true },
  });
  if (!participant) {
    throw new ApiError(
      "FORBIDDEN",
      "You must join the split before paying",
    );
  }
  // World Selfie Check gate (stretch): splits can require that every
  // payer is a verified human. Off by default; inert unless used.
  if (split.requireVerification && !participant.user.verifiedHuman) {
    throw new ApiError(
      "FORBIDDEN",
      "This split requires verified participants",
    );
  }
  if (participant.paid) {
    throw new ApiError("ALREADY_PAID", "You have already paid this split");
  }
  if (participant.txHash) {
    throw new ApiError(
      "PAYMENT_PENDING",
      "A payment for this split is still awaiting confirmation",
    );
  }
  if (amountToUnits(amount) !== decimalToUnits(participant.shareAmount)) {
    throw new ApiError(
      "AMOUNT_MISMATCH",
      "Amount does not match your share for this split",
    );
  }

  const updated = await prisma.splitParticipant.update({
    where: { id: participant.id },
    data: { txHash },
    include: { user: true },
  });

  return updated;
}
