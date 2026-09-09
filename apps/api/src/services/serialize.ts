import type { Prisma } from "@prisma/client";
import type {
  Participant,
  SplitDetail,
  SplitInvite,
  SplitStatus,
} from "@splithappens/shared";
import { decimalToAmount } from "../chain/units.js";

type SplitWithParticipants = Prisma.SplitGetPayload<{
  include: {
    participants: { include: { user: true } };
    invites: true;
  };
}>;

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

export function mapSplitDetail(split: SplitWithParticipants): SplitDetail {
  return {
    id: split.id.toString(),
    title: split.title,
    totalAmount: decimalToAmount(split.totalAmount),
    payeeAddress: split.payeeAddress,
    requireVerification: split.requireVerification,
    participantCount: split.participantCount,
    status: mapSplitStatus(split.status),
    releaseTxHash: split.releaseTxHash,
    releasedAt: split.releasedAt?.toISOString() ?? null,
    createdAt: split.createdAt.toISOString(),
    participants: split.participants.map(mapParticipant),
    invites: split.invites.map(mapInvite),
  };
}
