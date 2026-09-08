/**
 * Serialization helpers for the split domain.
 *
 * DB rows carry Decimal and BigInt values that JSON.stringify cannot emit
 * faithfully; every response passes through these mappers so amounts are
 * decimal strings and ids are strings.
 */

import type { Prisma } from "@prisma/client";
import type {
  Participant,
  SplitDetail,
  SplitStatus,
} from "@splitstream/shared";
import { decimalToAmount } from "../chain/units.js";

type SplitWithParticipants = Prisma.SplitGetPayload<{
  include: { participants: { include: { user: true } } };
}>;

type SplitParticipantRow = SplitWithParticipants["participants"][number];

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

export function mapSplitDetail(split: SplitWithParticipants): SplitDetail {
  return {
    id: split.id.toString(),
    title: split.title,
    totalAmount: decimalToAmount(split.totalAmount),
    payeeAddress: split.payeeAddress,
    requireVerification: split.requireVerification,
    status: mapSplitStatus(split.status),
    releaseTxHash: split.releaseTxHash,
    releasedAt: split.releasedAt?.toISOString() ?? null,
    createdAt: split.createdAt.toISOString(),
    participants: split.participants.map(mapParticipant),
  };
}
