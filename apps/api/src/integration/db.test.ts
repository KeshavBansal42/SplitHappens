import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { prisma } from "../db.js";
import { joinSplit, paySplit, getSplitOrThrow } from "../services/splits.js";

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TX_HASH = "0x" + "ab".repeat(32);

async function createUser(privyUserId: string, walletAddress: string | null) {
  return prisma.user.upsert({
    where: { privyUserId },
    create: { privyUserId, walletAddress },
    update: {},
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.splitParticipant.deleteMany();
  await prisma.split.deleteMany();
  await prisma.user.deleteMany();
});

describe("db round-trips", () => {
  it("persists a split with exact decimal amounts and bigint id", async () => {
    const user = await createUser("dev:alice", WALLET);

    const split = await prisma.split.create({
      data: {
        title: "Rent",
        totalAmount: "1234.567890",
        payeeAddress: user.walletAddress!,
      },
    });

    const fetched = await prisma.split.findUniqueOrThrow({ where: { id: split.id } });
    expect(fetched.id).toBe(split.id);
    expect(fetched.id).toBeGreaterThan(0n);
    expect(fetched.totalAmount.toString()).toBe("1234.56789");
    expect(fetched.status).toBe("PENDING");
  });

  it("upserts a user once per privy id", async () => {
    const a = await createUser("dev:same", WALLET);
    const b = await createUser("dev:same", null);
    expect(a.id).toBe(b.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("enforces the unique split+user participant constraint", async () => {
    const user = await createUser("dev:bob", BOB_WALLET);
    const split = await prisma.split.create({
      data: { title: "Trip", totalAmount: "100", payeeAddress: WALLET },
    });

    await prisma.splitParticipant.create({
      data: { splitId: split.id, userId: user.id, shareAmount: "50" },
    });
    await expect(
      prisma.splitParticipant.create({
        data: { splitId: split.id, userId: user.id, shareAmount: "50" },
      }),
    ).rejects.toThrow();
  });
});

describe("service layer against real db", () => {
  it("joinSplit rejects an overflowing share", async () => {
    const payee = await createUser("dev:payee", WALLET);
    const bob = await createUser("dev:bob", BOB_WALLET);
    const split = await prisma.split.create({
      data: { title: "Trip", totalAmount: "50", payeeAddress: payee.walletAddress! },
    });

    const carol = await createUser("dev:carol", WALLET);
    await joinSplit(split.id, carol.id, "40");

    await expect(joinSplit(split.id, bob.id, "20")).rejects.toMatchObject({
      code: "SHARE_OVERFLOW",
    });
  });

  it("paySplit records intent then rejects duplicates while pending", async () => {
    const payee = await createUser("dev:payee", WALLET);
    const bob = await createUser("dev:bob", BOB_WALLET);
    const split = await prisma.split.create({
      data: { title: "Trip", totalAmount: "100", payeeAddress: payee.walletAddress! },
    });
    await joinSplit(split.id, bob.id, "50");

    await paySplit(split.id, bob.id, TX_HASH, "50");
    const detail = await getSplitOrThrow(split.id);
    const participant = detail.participants[0]!;
    expect(participant.txHash).toBe(TX_HASH);
    expect(participant.paid).toBe(false);

    await expect(paySplit(split.id, bob.id, TX_HASH, "50")).rejects.toMatchObject({
      code: "PAYMENT_PENDING",
    });
  });

  it("paySplit rejects an amount mismatch", async () => {
    const payee = await createUser("dev:payee", WALLET);
    const bob = await createUser("dev:bob", BOB_WALLET);
    const split = await prisma.split.create({
      data: { title: "Trip", totalAmount: "100", payeeAddress: payee.walletAddress! },
    });
    await joinSplit(split.id, bob.id, "50");

    await expect(paySplit(split.id, bob.id, TX_HASH, "51")).rejects.toMatchObject({
      code: "AMOUNT_MISMATCH",
    });
  });
});
