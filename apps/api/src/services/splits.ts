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
