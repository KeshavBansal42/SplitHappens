import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createFakePrisma, type FakePrisma, type Row } from "../test/fakePrisma.js";

const hoisted = vi.hoisted(() => {
  const state = {
    statuses: new Map<string, Map<bigint, { collected: bigint; target: bigint; released: boolean }>>(),
    receipts: new Map<string, Record<string, unknown>>(),
    transactions: new Map<string, Record<string, unknown>>(),
    writeCalls: [] as unknown[],
  };
  const stub = {
    state,
    getTransactionReceipt: async (_client: unknown, params: { hash: string }) => {
      const receipt = state.receipts.get(params.hash);
      if (!receipt) throw new Error(`no receipt for ${params.hash}`);
      return receipt;
    },
    getTransaction: async (_client: unknown, params: { hash: string }) => {
      const tx = state.transactions.get(params.hash);
      if (!tx) throw new Error(`no tx for ${params.hash}`);
      return tx;
    },
    readContract: async (
      _client: unknown,
      params: { address: string; args: [bigint] },
    ) => {
      const { address, args } = params;
      const bySplit = state.statuses.get(address.toLowerCase());
      if (!bySplit) throw new Error(`no escrow ${address}`);
      const status = bySplit.get(args[0]);
      if (!status) throw new Error(`no status for split ${args[0]}`);
      return [status.collected, status.target, status.released] as const;
    },
    writeContract: async (...args: unknown[]) => {
      state.writeCalls.push(args);
      return "0xshouldnotbeused";
    },
  };
  return { stub };
});

const chainStub = hoisted.stub;

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("./client.js", () => ({
  getPublicClient: () => ({ chain: { id: 5042002 } }),
}));

vi.mock("viem/actions", () => ({
  getTransactionReceipt: (...args: unknown[]) =>
    hoisted.stub.getTransactionReceipt(args[0] as never, args[1] as never),
  getTransaction: (...args: unknown[]) =>
    hoisted.stub.getTransaction(args[0] as never, args[1] as never),
  readContract: (...args: unknown[]) =>
    hoisted.stub.readContract(args[0] as never, args[1] as never),
  writeContract: (...args: unknown[]) => hoisted.stub.writeContract(...args),
}));

import { prisma } from "../db.js";
import { confirmTick } from "./confirm.js";
import { releaseTick } from "./release.js";

const db = prisma as unknown as FakePrisma;
const decimal = (v: string) => new Prisma.Decimal(v);

const ESCROW = "0x2222222222222222222222222222222222222222";
const BOB_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ALICE_WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX = "0x" + "cd".repeat(32);

function seedSplit(status = "PENDING") {
  db.split.seed([
    {
      id: 1n,
      title: "Dinner",
      totalAmount: decimal("60.00"),
      payeeAddress: ALICE_WALLET,
      requireVerification: false,
      status,
      openedAt: new Date(),
      openTxHash: TX,
      releaseTxHash: null,
      releasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [],
    } as unknown as Row,
  ]);
}

function seedPendingParticipant() {
  db.splitParticipant.seed([
    {
      id: "p_1",
      splitId: 1n,
      userId: "u_bob",
      user: {
        id: "u_bob",
        privyUserId: "dev:bob",
        walletAddress: BOB_WALLET,
        verifiedHuman: false,
      },
      shareAmount: decimal("30.00"),
      paid: false,
      txHash: TX,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Row,
  ]);
}

function seedEscrowStatus(status: { collected: bigint; target: bigint; released: boolean }) {
  const bySplit = chainStub.state.statuses.get(ESCROW) ?? new Map<bigint, typeof status>();
  bySplit.set(1n, status);
  chainStub.state.statuses.set(ESCROW, bySplit);
}

beforeEach(() => {
  db.user.clear();
  db.split.clear();
  db.splitParticipant.clear();
  chainStub.state.receipts.clear();
  chainStub.state.transactions.clear();
  chainStub.state.writeCalls.length = 0;
  chainStub.state.statuses.clear();
});

describe("confirmTick", () => {
  it("marks a participant paid on a valid deposit receipt", async () => {
    seedSplit();
    seedPendingParticipant();
    chainStub.state.receipts.set(TX, { status: "success", to: ESCROW, from: BOB_WALLET });
    chainStub.state.transactions.set(TX, { input: encodeDeposit(1n, 30000000n) });

    await confirmTick();

    const row = db.splitParticipant.rows[0] as unknown as {
      paid?: boolean;
      txHash?: string | null;
      confirmedAt?: Date | null;
    };
    expect(row.paid).toBe(true);
    expect(row.txHash).toBe(TX);
    expect(row.confirmedAt).toBeInstanceOf(Date);
    expect((db.split.rows[0] as unknown as { status?: string }).status).toBe("PARTIALLY_PAID");
  });

  it("clears the txHash when the receipt did not target the escrow", async () => {
    seedSplit();
    seedPendingParticipant();
    chainStub.state.receipts.set(TX, {
      status: "success",
      to: "0x9999999999999999999999999999999999999999",
      from: BOB_WALLET,
    });
    chainStub.state.transactions.set(TX, { input: encodeDeposit(1n, 30000000n) });

    await confirmTick();

    const row = db.splitParticipant.rows[0] as unknown as { paid?: boolean; txHash?: string | null };
    expect(row.paid).toBe(false);
    expect(row.txHash).toBeNull();
  });

  it("clears the txHash when the deposited amount differs from the share", async () => {
    seedSplit();
    seedPendingParticipant();
    chainStub.state.receipts.set(TX, { status: "success", to: ESCROW, from: BOB_WALLET });
    chainStub.state.transactions.set(TX, { input: encodeDeposit(1n, 99000000n) });

    await confirmTick();

    const row = db.splitParticipant.rows[0] as unknown as { paid?: boolean; txHash?: string | null };
    expect(row.paid).toBe(false);
    expect(row.txHash).toBeNull();
  });

  it("leaves the row pending when the receipt is not mined yet", async () => {
    seedSplit();
    seedPendingParticipant();

    await confirmTick();

    const row = db.splitParticipant.rows[0] as unknown as { paid?: boolean; txHash?: string | null };
    expect(row.paid).toBe(false);
    expect(row.txHash).toBe(TX);
  });
});

describe("releaseTick", () => {
  it("mirrors an on-chain release into the db without sending a tx", async () => {
    seedSplit("PARTIALLY_PAID");
    seedEscrowStatus({ collected: 60000000n, target: 60000000n, released: true });

    await releaseTick();

    const split = db.split.rows[0] as unknown as {
      status?: string;
      releasedAt?: Date | null;
    };
    expect(split.status).toBe("RELEASED");
    expect(split.releasedAt).toBeInstanceOf(Date);
    expect(chainStub.state.writeCalls).toHaveLength(0);
  });

  it("does nothing while the split is underfunded", async () => {
    seedSplit();
    seedEscrowStatus({ collected: 30000000n, target: 60000000n, released: false });

    await releaseTick();

    expect(chainStub.state.writeCalls).toHaveLength(0);
    expect((db.split.rows[0] as unknown as { status?: string }).status).toBe("PENDING");
  });

  it("skips splits already released", async () => {
    seedSplit("RELEASED");
    seedEscrowStatus({ collected: 60000000n, target: 60000000n, released: true });

    await releaseTick();

    expect(chainStub.state.writeCalls).toHaveLength(0);
  });
});

function encodeDeposit(splitId: bigint, amount: bigint): `0x${string}` {
  const sig = "0xe2bbb158";
  const idHex = splitId.toString(16).padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  return `${sig}${idHex}${amountHex}` as `0x${string}`;
}
