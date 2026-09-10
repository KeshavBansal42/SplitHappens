import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma, type Row } from "../test/fakePrisma.js";
import { createMockEscrow, type MockEscrow } from "../test/mockEscrow.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("../chain/escrow.js", async () => {
  const { createMockEscrow } = await import("../test/mockEscrow.js");
  const mock = createMockEscrow();
  return { verifyOpenSplitTx: mock.verifyOpenSplitTx };
});

import { prisma } from "../db.js";
import { verifyOpenSplitTx } from "../chain/escrow.js";
import { ApiError } from "../errors.js";

const db = prisma as unknown as FakePrisma;
const mockEscrow = { verifyOpenSplitTx } as unknown as MockEscrow;
const app = createApp();

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX_HASH = "0x" + "ab".repeat(32);
const decimal = (v: string) => new Prisma.Decimal(v);

function devHeaders(userId = "alice") {
  return { "x-dev-user-id": userId, "x-dev-wallet": WALLET };
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Dinner",
    totalAmount: "120.00",
    payeeAddress: WALLET,
    participantCount: 3,
    invites: [{ email: "bob@example.com" }, { email: "carol@example.com" }],
    ...overrides,
  };
}

describe("POST /api/v1/splits", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
    mockEscrow.verifyOpenSplitTx.mockClear();
  });

  it("creates an unopened split with equal shares", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody());

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("1");
    expect(res.body.totalAmount).toBe("120.00");
    expect(res.body.status).toBe("pending");
    expect(res.body.participantCount).toBe(3);
    expect(res.body.opened).toBe(false);
    expect(res.body.openTxHash).toBeNull();
    expect(res.body.creatorId).toBeTruthy();
    expect(res.body.participants[0].shareAmount).toBe("40");
    expect(res.body.invites.map((i: { shareAmount: string }) => i.shareAmount)).toEqual([
      "40",
      "40",
    ]);
    expect(mockEscrow.verifyOpenSplitTx).not.toHaveBeenCalled();
  });

  it("rejects when invites do not match the participant count", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody({ participantCount: 4 }));

    expect(res.status).toBe(422);
  });

  it("requires auth (401 in dev mode without the header)", async () => {
    const res = await request(app).post("/api/v1/splits").send(createBody());
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/splits/:id/open", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
    mockEscrow.verifyOpenSplitTx.mockClear();
  });

  async function createSplitAs(userId: string) {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders(userId))
      .send(createBody());
    return res.body as { id: string; creatorId: string };
  }

  it("marks the split opened for the creator", async () => {
    const created = await createSplitAs("alice");

    const res = await request(app)
      .post(`/api/v1/splits/${created.id}/open`)
      .set(devHeaders("alice"))
      .send({ txHash: TX_HASH });

    expect(res.status).toBe(200);
    expect(res.body.opened).toBe(true);
    expect(res.body.openTxHash).toBe(TX_HASH);
  });

  it("rejects a non-creator with 403", async () => {
    const created = await createSplitAs("alice");

    const res = await request(app)
      .post(`/api/v1/splits/${created.id}/open`)
      .set(devHeaders("bob"))
      .send({ txHash: TX_HASH });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/v1/splits/invited", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
  });

  it("lists splits the caller was invited to with their share", async () => {
    db.user.seed([
      {
        id: "u_bob",
        privyUserId: "dev:bob",
        email: "bob@example.com",
        walletAddress: WALLET,
        verifiedHuman: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Row,
    ]);
    db.splitInvite.seed([
      {
        id: "inv_1",
        splitId: 5n,
        email: "bob@example.com",
        shareAmount: decimal("40"),
        claimedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        split: {
          id: 5n,
          title: "Trip",
          totalAmount: decimal("120"),
          payeeAddress: WALLET,
          status: "PENDING",
          participantCount: 3,
          openedAt: new Date(),
          createdAt: new Date(),
        },
      } as unknown as Row,
    ]);

    const res = await request(app)
      .get("/api/v1/splits/invited")
      .set({ "x-dev-user-id": "bob", "x-dev-email": "bob@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.viewerId).toBe("u_bob");
    expect(res.body.splits).toHaveLength(1);
    expect(res.body.splits[0]).toMatchObject({
      id: "5",
      title: "Trip",
      opened: true,
      myShareAmount: "40",
    });
  });

  it("returns an empty list when the caller has no email", async () => {
    const res = await request(app).get("/api/v1/splits/invited").set(devHeaders());
    expect(res.status).toBe(200);
    expect(res.body.splits).toEqual([]);
  });
});

describe("GET /api/v1/splits/mine", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
  });

  it("lists splits the caller participates in", async () => {
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
    db.splitParticipant.seed([
      {
        id: "p_1",
        splitId: 7n,
        userId: "u_alice",
        shareAmount: decimal("40"),
        paid: false,
        txHash: null,
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        split: {
          id: 7n,
          title: "Rent",
          totalAmount: decimal("120"),
          payeeAddress: WALLET,
          status: "PENDING",
          participantCount: 3,
          openedAt: null,
          createdAt: new Date(),
        },
      } as unknown as Row,
    ]);

    const res = await request(app).get("/api/v1/splits/mine").set(devHeaders());

    expect(res.status).toBe(200);
    expect(res.body.viewerId).toBe("u_alice");
    expect(res.body.splits).toHaveLength(1);
    expect(res.body.splits[0]).toMatchObject({ id: "7", title: "Rent", opened: false });
  });
});
