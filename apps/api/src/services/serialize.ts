import { Prisma } from "@prisma/client";
import type {
  Participant,
  SplitDetail,
  SplitInvite,
  SplitStatus,
  SplitSummary,
} from "@splithappens/shared";
import { decimalToAmount, decimalToUnits, unitsToAmount } from "../chain/units.js";

type SplitWithParticipants = Prisma.SplitGetPayload<{
  include: {
    participants: { include: { user: true } };
    invites: true;
  };
}>;

type SplitRow = Prisma.SplitGetPayload<Record<string, never>>;

type SummarySplit = SplitRow & {
  participants?: Array<{ shareAmount: Prisma.Decimal; paid: boolean }>;
};

type SplitParticipantRow = SplitWithParticipants["participants"][number];
type SplitInviteRow = SplitWithParticipants["invites"][number];

export function mapSplitStatus(status: SplitWithParticipants["status"]): SplitStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "PARTIALLY_PAID":
      return "partially_paid";
    case "RELEASED":
      return "released";
  }
}

export function mapParticipant(row: SplitParticipantRow): Participant {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email ?? null,
    walletAddress: row.user.walletAddress,
    shareAmount: decimalToAmount(row.shareAmount),
    paid: row.paid,
    txHash: row.txHash,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

export function mapInvite(row: SplitInviteRow): SplitInvite {
  return {
    id: row.id,
    email: row.email,
    shareAmount: decimalToAmount(row.shareAmount),
    claimed: row.claimedByUserId !== null,
  };
}

export function mapSplitSummary(
  split: SummarySplit,
  myShareAmount?: Prisma.Decimal | null,
): SplitSummary {
  const paid = (split.participants ?? []).filter((p) => p.paid);
  let paidUnits = 0n;
  for (const p of paid) paidUnits += decimalToUnits(p.shareAmount);

  return {
    id: split.id.toString(),
    title: split.title,
    totalAmount: decimalToAmount(split.totalAmount),
    payeeAddress: split.payeeAddress,
    status: mapSplitStatus(split.status),
    participantCount: split.participantCount,
    opened: split.openedAt !== null,
    paidAmount: unitsToAmount(paidUnits),
    paidCount: paid.length,
    myShareAmount: myShareAmount ? decimalToAmount(myShareAmount) : null,
    createdAt: split.createdAt.toISOString(),
  };
}

export function mapSplitDetail(
  split: SplitWithParticipants,
  viewerId?: string,
): SplitDetail {
  // Only the creator gets to see who has been invited.
  const includeInvites = split.creatorId === viewerId;

  return {
    id: split.id.toString(),
    title: split.title,
    totalAmount: decimalToAmount(split.totalAmount),
    payeeAddress: split.payeeAddress,
    requireVerification: split.requireVerification,
    participantCount: split.participantCount,
    creatorId: split.creatorId ?? "",
    opened: split.openedAt !== null,
    openTxHash: split.openTxHash,
    status: mapSplitStatus(split.status),
    releaseTxHash: split.releaseTxHash,
    releasedAt: split.releasedAt?.toISOString() ?? null,
    createdAt: split.createdAt.toISOString(),
    participants: split.participants.map(mapParticipant),
    invites: includeInvites ? split.invites.map(mapInvite) : [],
  };
}
