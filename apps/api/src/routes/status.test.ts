import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma, type Row } from "../test/fakePrisma.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("../chain/reader.js", async () => {
  const { getEscrowStatus } = await import("../test/stubReader.js");
  return { getEscrowStatus };
});

import { prisma } from "../db.js";
import { setEscrowStatus } from "../test/stubReader.js";

const db = prisma as unknown as FakePrisma;
const app = createApp();

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const decimal = (v: string) => new Prisma.Decimal(v);

describe("GET /api/v1/splits/:id/status", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
    setEscrowStatus({ collected: 0n, target: 0n, released: false });
  });

  it("returns db split state with zero on-chain defaults", async () => {
    db.split.seed([
      {
        id: 1n,
        title: "Dinner",
        totalAmount: decimal("120.00"),
        payeeAddress: WALLET,
        requireVerification: false,
        participantCount: 2,
        creatorId: "u_alice",
        openedAt: new Date(),
        openTxHash: null,
        status: "PENDING",
        releaseTxHash: null,
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        invites: [],
      } as unknown as Row,
    ]);

    const res = await request(app)
      .get("/api/v1/splits/1/status")
      .set({ "x-dev-user-id": "alice", "x-dev-wallet": WALLET });

    expect(res.status).toBe(200);
    expect(res.body.split).toMatchObject({ id: "1", status: "pending" });
    expect(res.body.onChain).toEqual({ collected: "0", target: "0", released: false });
    expect(res.body.participants).toEqual([]);
    expect(res.body.invites).toEqual([]);
  });

  it("merges on-chain escrow state when the chain read succeeds", async () => {
    setEscrowStatus({ collected: 90000000n, target: 120000000n, released: false });

    db.split.seed([
      {
        id: 1n,
        title: "Dinner",
        totalAmount: decimal("120.00"),
        payeeAddress: WALLET,
        requireVerification: false,
        participantCount: 2,
        creatorId: "u_alice",
        openedAt: new Date(),
        openTxHash: null,
        status: "PARTIALLY_PAID",
        releaseTxHash: null,
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        invites: [],
      } as unknown as Row,
    ]);

    const res = await request(app)
      .get("/api/v1/splits/1/status")
      .set({ "x-dev-user-id": "alice", "x-dev-wallet": WALLET });

    expect(res.status).toBe(200);
    expect(res.body.split.status).toBe("partially_paid");
    expect(res.body.onChain).toEqual({ collected: "90", target: "120", released: false });
  });

  it("returns 404 for an unknown split", async () => {
    const res = await request(app)
      .get("/api/v1/splits/999/status")
      .set({ "x-dev-user-id": "alice", "x-dev-wallet": WALLET });
    expect(res.status).toBe(404);
  });
});

describe("invite visibility on split status", () => {
  const BOB_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
    setEscrowStatus({ collected: 0n, target: 0n, released: false });
  });

  function seed() {
    db.user.seed([
      {
        id: "u_alice",
        privyUserId: "dev:alice",
        email: "alice@example.com",
        walletAddress: WALLET,
        verifiedHuman: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Row,
    ]);
    db.split.seed([
      {
        id: 1n,
        title: "Dinner",
        totalAmount: decimal("120.00"),
        payeeAddress: WALLET,
        requireVerification: false,
        participantCount: 3,
        creatorId: "u_alice",
        openedAt: new Date(),
        openTxHash: null,
        status: "PENDING",
        releaseTxHash: null,
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        invites: [
          {
            id: "inv_1",
            splitId: 1n,
            email: "carol@example.com",
            shareAmount: decimal("40"),
            claimedByUserId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as unknown as Row,
    ]);
  }

  it("shows invites to the creator", async () => {
    seed();
    const res = await request(app)
      .get("/api/v1/splits/1/status")
      .set({ "x-dev-user-id": "alice", "x-dev-wallet": WALLET });

    expect(res.status).toBe(200);
    expect(res.body.invites).toHaveLength(1);
  });

  it("hides invites from everyone else", async () => {
    seed();
    const res = await request(app)
      .get("/api/v1/splits/1/status")
      .set({ "x-dev-user-id": "bob", "x-dev-wallet": BOB_WALLET });

    expect(res.status).toBe(200);
    expect(res.body.invites).toEqual([]);
  });
});
