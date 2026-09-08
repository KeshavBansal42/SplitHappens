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
const BOB_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TX_HASH = "0x" + "ab".repeat(32);
const decimal = (v: string) => new Prisma.Decimal(v);
const BOB_USER_ID = "u_bob";

function seedBobUser() {
  db.user.seed([
    {
      id: BOB_USER_ID,
      privyUserId: "dev:bob",
      walletAddress: BOB_WALLET,
      verifiedHuman: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Row,
  ]);
}

function seedSplit(totalAmount: string, status = "PENDING") {
  db.split.seed([
    {
      id: 1n,
      title: "Dinner",
      totalAmount: decimal(totalAmount),
      payeeAddress: WALLET,
      requireVerification: false,
      status,
      releaseTxHash: null,
      releasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [],
    } as unknown as Row,
  ]);
}

function seedParticipant(overrides: Partial<Row> = {}) {
  const participant = {
    id: "p_1",
    splitId: 1n,
    userId: BOB_USER_ID,
    user: {
      id: BOB_USER_ID,
      privyUserId: "dev:bob",
      walletAddress: BOB_WALLET,
      verifiedHuman: false,
    },
    shareAmount: decimal("30.00"),
    paid: false,
    txHash: null,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.splitParticipant.seed([participant as unknown as Row]);
}

const BOB = { "x-dev-user-id": "bob", "x-dev-wallet": BOB_WALLET };
const CAROL = { "x-dev-user-id": "carol", "x-dev-wallet": WALLET };

describe("POST /api/v1/splits/:id/join", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
  });

  it("adds the caller as a participant", async () => {
    seedBobUser();
    seedSplit("120.00");

    const res = await request(app)
      .post("/api/v1/splits/1/join")
      .set(BOB)
      .send({ shareAmount: "30.00" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      splitId: "1",
      userId: BOB_USER_ID,
      shareAmount: "30.00",
    });
    expect(db.splitParticipant.rows).toHaveLength(1);
  });

  it("rejects a duplicate join with 409", async () => {
    seedBobUser();
    seedSplit("120.00");
    seedParticipant();

    const res = await request(app)
      .post("/api/v1/splits/1/join")
      .set(BOB)
      .send({ shareAmount: "30.00" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects when shares exceed the total with 422", async () => {
    seedBobUser();
    seedSplit("50.00");
    seedParticipant({
      userId: "u_carol",
      user: {
        id: "u_carol",
        privyUserId: "dev:carol",
        walletAddress: WALLET,
        verifiedHuman: false,
      },
      shareAmount: decimal("40.00"),
    });

    const res = await request(app)
      .post("/api/v1/splits/1/join")
      .set(BOB)
      .send({ shareAmount: "20.00" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHARE_OVERFLOW");
  });

  it("rejects joining a released split with 409", async () => {
    seedBobUser();
    seedSplit("120.00", "RELEASED");

    const res = await request(app)
      .post("/api/v1/splits/1/join")
      .set(BOB)
      .send({ shareAmount: "30.00" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/splits/:id/pay", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
  });

  it("records the tx intent for a matching share", async () => {
    seedBobUser();
    seedSplit("120.00");
    seedParticipant();

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(BOB)
      .send({ txHash: TX_HASH, amount: "30.00" });

    expect(res.status).toBe(200);
    expect(res.body.paid).toBe(false);
    expect(res.body.txHash).toBe(TX_HASH);
    expect(res.body.walletAddress).toBe(BOB_WALLET);
  });

  it("rejects an amount that differs from the share with 422", async () => {
    seedBobUser();
    seedSplit("120.00");
    seedParticipant();

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(BOB)
      .send({ txHash: TX_HASH, amount: "31.00" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("AMOUNT_MISMATCH");
  });

  it("rejects paying a split the caller did not join with 403", async () => {
    seedSplit("120.00");

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(CAROL)
      .send({ txHash: TX_HASH, amount: "30.00" });

    expect(res.status).toBe(403);
  });

  it("rejects a duplicate pay while pending with 409", async () => {
    seedBobUser();
    seedSplit("120.00");
    seedParticipant({ txHash: TX_HASH });

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(BOB)
      .send({ txHash: TX_HASH, amount: "30.00" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PAYMENT_PENDING");
  });

  it("rejects paying a released split with 409", async () => {
    seedBobUser();
    seedSplit("120.00", "RELEASED");
    seedParticipant();

    const res = await request(app)
      .post("/api/v1/splits/1/pay")
      .set(BOB)
      .send({ txHash: TX_HASH, amount: "30.00" });

    expect(res.status).toBe(409);
  });
});
