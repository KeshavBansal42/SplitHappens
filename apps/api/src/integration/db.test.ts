import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { prisma } from "../db.js";
import {
  addInvites,
  createSplit,
  getSplitOrThrow,
  joinSplit,
  listInvited,
  listMine,
  markSplitOpened,
  paySplit,
} from "../services/splits.js";
import { sharesAsAmounts } from "../services/shares.js";

vi.mock("../chain/escrow.js", () => ({
  verifyOpenSplitTx: vi.fn(async () => undefined),
}));

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TX_HASH = "0x" + "ab".repeat(32);
const OPEN_TX = "0x" + "ef".repeat(32);

async function createUser(
  privyUserId: string,
  email: string | null,
  walletAddress: string | null,
) {
  return prisma.user.upsert({
    where: { privyUserId },
    create: { privyUserId, email, walletAddress },
    update: {},
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.splitInvite.deleteMany();
  await prisma.splitParticipant.deleteMany();
  await prisma.split.deleteMany();
  await prisma.user.deleteMany();
});

describe("share math", () => {
  it("splits an amount evenly across seats", () => {
    expect(sharesAsAmounts("120.00", 3)).toEqual(["40", "40", "40"]);
  });

  it("gives the last seat the rounding remainder", () => {
    expect(sharesAsAmounts("100.00", 3)).toEqual([
      "33.333333",
      "33.333333",
      "33.333334",
    ]);
  });

  it("handles a two person split", () => {
    expect(sharesAsAmounts("10.00", 2)).toEqual(["5", "5"]);
  });
});

describe("equal-share split lifecycle", () => {
  it("creates a split with creator seat, equal invites, and no open tx yet", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 3,
      inviteEmails: ["bob@example.com", "carol@example.com"],
      requireVerification: false,
    });

    expect(split.creatorId).toBe(creator.id);
    expect(split.openedAt).toBeNull();
    expect(split.participantCount).toBe(3);
    expect(split.participants).toHaveLength(1);
    expect(split.invites).toHaveLength(2);
    expect(split.invites.map((i) => i.shareAmount.toString())).toEqual(["40", "40"]);
  });

  it("marks a split opened when the open tx is verified", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });

    const opened = await markSplitOpened(split.id, OPEN_TX);
    expect(opened.openedAt).toBeInstanceOf(Date);
    expect(opened.openTxHash).toBe(OPEN_TX);
  });

  it("blocks joining while the split is not open", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);
    const bob = await createUser("dev:bob", "bob@example.com", BOB_WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });

    await expect(joinSplit(split.id, bob.id, "bob@example.com")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("lets an invited user claim their seat by email once open", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);
    const bob = await createUser("dev:bob", "bob@example.com", BOB_WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });
    await markSplitOpened(split.id, OPEN_TX);

    const share = await joinSplit(split.id, bob.id, "bob@example.com");
    expect(share).toBe("60");

    const detail = await getSplitOrThrow(split.id);
    expect(detail.participants).toHaveLength(2);
    expect(detail.invites[0]!.claimedByUserId).toBe(bob.id);
  });

  it("rejects a joiner whose email has no invite", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);
    const dave = await createUser("dev:dave", "dave@example.com", WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });
    await markSplitOpened(split.id, OPEN_TX);

    await expect(joinSplit(split.id, dave.id, "dave@example.com")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("adds invites before anyone joins and recomputes shares", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });

    const updated = await addInvites(split.id, creator.id, ["carol@example.com"]);
    expect(updated.participantCount).toBe(3);
    expect(updated.invites).toHaveLength(2);
    expect(updated.participants[0]!.shareAmount.toString()).toBe("40");
    expect(updated.invites.map((i) => i.shareAmount.toString())).toEqual(["40", "40"]);
  });

  it("locks adding invites once someone has joined", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);
    const bob = await createUser("dev:bob", "bob@example.com", BOB_WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });
    await markSplitOpened(split.id, OPEN_TX);
    await joinSplit(split.id, bob.id, "bob@example.com");

    await expect(addInvites(split.id, creator.id, ["carol@example.com"])).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("locks adding invites once the creator has a pending deposit", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });
    await markSplitOpened(split.id, OPEN_TX);
    await paySplit(split.id, creator.id, TX_HASH, "60");

    await expect(addInvites(split.id, creator.id, ["carol@example.com"])).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("discovery", () => {
  it("lists unclaimed invites for an email and splits for a participant", async () => {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);
    const bob = await createUser("dev:bob", "bob@example.com", BOB_WALLET);

    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });
    await markSplitOpened(split.id, OPEN_TX);

    const invited = await listInvited("bob@example.com");
    expect(invited).toHaveLength(1);
    expect(invited[0]!.split.id).toBe(split.id);

    const mine = await listMine(creator.id);
    expect(mine.map(({ split: s }) => s.id)).toContain(split.id);

    const bobMineBefore = await listMine(bob.id);
    expect(bobMineBefore).toHaveLength(0);
  });
});

describe("pay flow against real db", () => {
  async function openedTwoWaySplit() {
    const creator = await createUser("dev:alice", "alice@example.com", WALLET);
    const bob = await createUser("dev:bob", "bob@example.com", BOB_WALLET);
    const split = await createSplit(creator.id, {
      title: "Trip",
      totalAmount: "120.00",
      payeeAddress: WALLET,
      participantCount: 2,
      inviteEmails: ["bob@example.com"],
      requireVerification: false,
    });
    await markSplitOpened(split.id, OPEN_TX);
    await joinSplit(split.id, bob.id, "bob@example.com");
    return { split, creator, bob };
  }

  it("paySplit records intent then rejects duplicates while pending", async () => {
    const { split, bob } = await openedTwoWaySplit();

    await paySplit(split.id, bob.id, TX_HASH, "60");
    const detail = await getSplitOrThrow(split.id);
    const participant = detail.participants.find((p) => p.userId === bob.id)!;
    expect(participant.txHash).toBe(TX_HASH);
    expect(participant.paid).toBe(false);

    await expect(paySplit(split.id, bob.id, TX_HASH, "60")).rejects.toMatchObject({
      code: "PAYMENT_PENDING",
    });
  });

  it("paySplit rejects an amount mismatch", async () => {
    const { split, bob } = await openedTwoWaySplit();

    await expect(paySplit(split.id, bob.id, TX_HASH, "61")).rejects.toMatchObject({
      code: "AMOUNT_MISMATCH",
    });
  });
});
