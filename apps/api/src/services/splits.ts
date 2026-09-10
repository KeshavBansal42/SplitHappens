import { Prisma } from "@prisma/client";
import { ApiError } from "../errors.js";
import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import {
  amountToUnits,
  decimalToUnits,
} from "../chain/units.js";
import { verifyOpenSplitTx } from "../chain/escrow.js";
import { sharesAsAmounts } from "./shares.js";

export const splitWithParticipants = Prisma.validator<Prisma.SplitDefaultArgs>()({
  include: {
    participants: { include: { user: true } },
    invites: { orderBy: { createdAt: "asc" } },
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

export async function createSplit(
  creatorId: string,
  input: {
    title: string;
    totalAmount: string;
    payeeAddress: string;
    participantCount: number;
    inviteEmails: string[];
    requireVerification: boolean;
  },
): Promise<SplitWithParticipants> {
  const shares = sharesAsAmounts(input.totalAmount, input.participantCount);

  return prisma.$transaction(async (tx) => {
    const split = await tx.split.create({
      data: {
        title: input.title,
        totalAmount: input.totalAmount,
        payeeAddress: input.payeeAddress,
        requireVerification: input.requireVerification,
        participantCount: input.participantCount,
        creatorId,
        participants: {
          create: {
            userId: creatorId,
            shareAmount: shares[0]!,
          },
        },
        invites: {
          create: input.inviteEmails.map((email, i) => ({
            email,
            shareAmount: shares[i + 1]!,
          })),
        },
      },
      include: splitWithParticipants.include,
    });

    return split;
  });
}

export async function markSplitOpened(
  splitId: bigint,
  txHash: string,
): Promise<SplitWithParticipants> {
  const split = await getSplitOrThrow(splitId);

  if (split.openedAt) {
    return split;
  }

  // Dev mode has no wallet to sign with, so the chain check is skipped there.
  if (getConfig().AUTH_MODE !== "dev") {
    await verifyOpenSplitTx(splitId, {
      txHash,
      payeeAddress: split.payeeAddress,
      targetAmount: split.totalAmount.toString(),
      from: null,
    });
  }

  await prisma.split.update({
    where: { id: splitId },
    data: { openedAt: new Date(), openTxHash: txHash },
  });

  return getSplitOrThrow(splitId);
}

export async function listInvited(email: string) {
  return prisma.splitInvite.findMany({
    where: { email, claimedByUserId: null },
    include: { split: { include: { participants: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMine(userId: string) {
  const rows = await prisma.splitParticipant.findMany({
    where: { userId },
    include: { split: { include: { participants: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({ split: row.split, shareAmount: row.shareAmount }));
}

export async function joinSplit(splitId: bigint, userId: string, email: string): Promise<string> {
  const split = await getSplitOrThrow(splitId);

  if (!split.openedAt) {
    throw new ApiError("CONFLICT", "Split is not open yet");
  }

  if (split.status === "RELEASED") {
    throw new ApiError("CONFLICT", "Split is already released");
  }

  const existing = await prisma.splitParticipant.findUnique({
    where: { splitId_userId: { splitId, userId } },
  });
  if (existing) {
    throw new ApiError("CONFLICT", "You have already joined this split");
  }

  const invite = await prisma.splitInvite.findUnique({
    where: { splitId_email: { splitId, email } },
  });
  if (!invite) {
    throw new ApiError("FORBIDDEN", "You are not invited to this split");
  }
  if (invite.claimedByUserId) {
    throw new ApiError("CONFLICT", "This invite has already been claimed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.splitInvite.update({
      where: { id: invite.id },
      data: { claimedByUserId: userId },
    });
    await tx.splitParticipant.create({
      data: {
        splitId,
        userId,
        shareAmount: invite.shareAmount,
      },
    });
  });

  return invite.shareAmount.toFixed();
}

export async function addInvites(
  splitId: bigint,
  creatorId: string,
  emails: string[],
): Promise<SplitWithParticipants> {
  const split = await getSplitOrThrow(splitId);

  if (split.status === "RELEASED") {
    throw new ApiError("CONFLICT", "Split is already released");
  }

  if (split.creatorId !== creatorId) {
    throw new ApiError("FORBIDDEN", "Only the split creator can add people");
  }

  const creator = split.participants.find((p) => p.userId === creatorId);
  if (!creator) {
    throw new ApiError("FORBIDDEN", "Only the split creator can add people");
  }

  // Locked once anyone else joins, or once a deposit exists. Adding a seat
  // after money is in would recompute every share and strand what's already
  // been deposited.
  const locked = split.participants.some(
    (p) => p.userId !== creatorId || p.paid || p.txHash !== null,
  );
  if (locked) {
    throw new ApiError("CONFLICT", "This split is already locked");
  }

  const existingEmails = new Set([
    ...split.invites.map((i) => i.email),
  ]);
  const uniqueEmails = [...new Set(emails)];
  if (uniqueEmails.length !== emails.length) {
    throw new ApiError("VALIDATION_ERROR", "Duplicate invite emails");
  }
  for (const email of uniqueEmails) {
    if (existingEmails.has(email)) {
      throw new ApiError("CONFLICT", `${email} is already invited`);
    }
  }

  const newCount = split.participantCount + uniqueEmails.length;
  const shares = sharesAsAmounts(split.totalAmount.toString(), newCount);

  return prisma.$transaction(async (tx) => {
    await tx.split.update({
      where: { id: splitId },
      data: { participantCount: newCount },
    });

    await tx.splitParticipant.update({
      where: { id: creator.id },
      data: { shareAmount: shares[0]! },
    });

    const existing = await tx.splitInvite.findMany({
      where: { splitId },
      orderBy: { createdAt: "asc" },
    });
    for (let i = 0; i < existing.length; i++) {
      await tx.splitInvite.update({
        where: { id: existing[i]!.id },
        data: { shareAmount: shares[i + 1]! },
      });
    }

    await tx.splitInvite.createMany({
      data: uniqueEmails.map((email, i) => ({
        splitId,
        email,
        shareAmount: shares[existing.length + 1 + i]!,
      })),
    });

    return tx.split.findUniqueOrThrow({
      where: { id: splitId },
      include: splitWithParticipants.include,
    });
  });
}

export async function paySplit(
  splitId: bigint,
  userId: string,
  txHash: string,
  amount: string,
) {
  const split = await getSplitOrThrow(splitId);

  if (!split.openedAt) {
    throw new ApiError("CONFLICT", "Split is not open yet");
  }

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
