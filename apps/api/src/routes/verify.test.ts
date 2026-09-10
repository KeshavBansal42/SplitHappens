import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma, type Row } from "../test/fakePrisma.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

import { prisma } from "../db.js";

const db = prisma as unknown as FakePrisma;
const app = createApp();

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const decimal = (v: string) => new Prisma.Decimal(v);

const ALICE = { "x-dev-user-id": "alice", "x-dev-wallet": WALLET };

function seedAliceUser(verifiedHuman = false) {
  db.user.seed([
    {
      id: "u_alice",
      privyUserId: "dev:alice",
      walletAddress: WALLET,
      verifiedHuman,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Row,
  ]);
}

function seedSplit(requireVerification: boolean) {
  db.split.seed([
    {
      id: 1n,
      title: "Gated dinner",
      totalAmount: decimal("100.00"),
      payeeAddress: WALLET,
      requireVerification,
      status: "PENDING",
      creatorId: "u_alice",
      openedAt: new Date(),
      openTxHash: null,
      releaseTxHash: null,
      releasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [],
      invites: [],
    } as unknown as Row,
  ]);
}

function seedAliceParticipant(verifiedHuman = false) {
  const participant = {
    id: "p_1",
    splitId: 1n,
    userId: "u_alice",
    user: {
      id: "u_alice",
      privyUserId: "dev:alice",
      walletAddress: WALLET,
      verifiedHuman,
    },
    shareAmount: decimal("50.00"),
    paid: false,
    txHash: null,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.splitParticipant.seed([participant as unknown as Row]);
}

describe("POST /api/v1/verify", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
  });

  it("marks the caller as a verified human", async () => {
    seedAliceUser();

    const res = await request(app)
      .post("/api/v1/verify")
      .set(ALICE)
      .send({ proofToken: "world-proof-123" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verifiedHuman: true });
    const user = db.user.rows[0] as unknown as { verifiedHuman?: boolean };
    expect(user.verifiedHuman).toBe(true);
  });

  it("rejects a missing proof token with 422", async () => {
    seedAliceUser();

    const res = await request(app).post("/api/v1/verify").set(ALICE).send({});

    expect(res.status).toBe(422);
  });
});

describe("requireVerification gate on pay", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
  });

  it("blocks an unverified participant from paying a gated split", async () => {
    seedAliceUser();
    seedSplit(true);
    seedAliceParticipant(false);

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(ALICE)
      .send({
        txHash: "0x" + "ab".repeat(32),
        amount: "50.00",
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows a verified participant to pay a gated split", async () => {
    seedAliceUser(true);
    seedSplit(true);
    seedAliceParticipant(true);

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(ALICE)
      .send({
        txHash: "0x" + "ab".repeat(32),
        amount: "50.00",
      });

    expect(res.status).toBe(200);
  });

  it("does not gate splits that do not require verification", async () => {
    seedAliceUser();
    seedSplit(false);
    seedAliceParticipant(false);

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(ALICE)
      .send({
        txHash: "0x" + "ab".repeat(32),
        amount: "50.00",
      });

    expect(res.status).toBe(200);
  });
});
