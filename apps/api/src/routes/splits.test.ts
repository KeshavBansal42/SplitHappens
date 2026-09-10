import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma } from "../test/fakePrisma.js";
import { createMockEscrow, type MockEscrow } from "../test/mockEscrow.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("../chain/escrow.js", async () => {
  const { createMockEscrow } = await import("../test/mockEscrow.js");
  const mock = createMockEscrow();
  return { openSplitEscrow: mock.openSplitEscrow };
});

import { prisma } from "../db.js";
import { openSplitEscrow } from "../chain/escrow.js";

const db = prisma as unknown as FakePrisma;
const mockEscrow = { openSplitEscrow } as unknown as MockEscrow;
const app = createApp();

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

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
    mockEscrow.openSplitEscrow.mockClear();
  });

  it("creates a split with equal shares and opens it on-chain", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody());

    expect(res.status).toBe(201);
    if (res.status !== 201) console.error("CREATE ERR", JSON.stringify(res.body));
    expect(res.body.totalAmount).toBe("120.00");
    expect(res.body.status).toBe("pending");
    expect(res.body.participantCount).toBe(3);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.participants[0].shareAmount).toBe("40");
    expect(res.body.invites).toHaveLength(2);
    expect(res.body.invites.map((i: { shareAmount: string }) => i.shareAmount)).toEqual(["40", "40"]);
    expect(mockEscrow.openSplitEscrow).toHaveBeenCalledWith(
      1n,
      WALLET,
      "120.00",
    );
  });

  it("gives the last seat the rounding remainder", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody({ totalAmount: "100.00" }));

    expect(res.status).toBe(201);
    expect(res.body.participants[0].shareAmount).toBe("33.333333");
    expect(res.body.invites.map((i: { shareAmount: string }) => i.shareAmount)).toEqual([
      "33.333333",
      "33.333334",
    ]);
  });

  it("rejects when invites do not match the participant count", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody({ participantCount: 4 }));

    expect(res.status).toBe(422);
    expect(mockEscrow.openSplitEscrow).not.toHaveBeenCalled();
  });

  it("deletes the split row when the on-chain open fails", async () => {
    mockEscrow.openSplitEscrow.mockRejectedValueOnce(
      Object.assign(new Error("rpc down"), { code: "CHAIN_ERROR" }),
    );

    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody());

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("CHAIN_ERROR");
    expect(db.split.rows).toHaveLength(0);
  });

  it("rejects an invalid amount with 422", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send(createBody({ totalAmount: "12.5.5" }));

    expect(res.status).toBe(422);
    expect(mockEscrow.openSplitEscrow).not.toHaveBeenCalled();
  });

  it("requires auth (401 in dev mode without the header)", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .send(createBody());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
