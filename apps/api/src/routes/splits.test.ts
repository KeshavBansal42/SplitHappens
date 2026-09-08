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

describe("POST /api/v1/splits", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    mockEscrow.openSplitEscrow.mockClear();
  });

  it("creates a split, opens it on-chain, and returns 201", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send({
        title: "Dinner",
        totalAmount: "120.00",
        payeeAddress: WALLET,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("1");
    expect(res.body.totalAmount).toBe("120.00");
    expect(res.body.status).toBe("pending");
    expect(res.body.requireVerification).toBe(false);
    expect(mockEscrow.openSplitEscrow).toHaveBeenCalledWith(
      1n,
      WALLET,
      "120.00",
    );
    expect(db.split.rows).toHaveLength(1);
  });

  it("deletes the split row when the on-chain open fails", async () => {
    mockEscrow.openSplitEscrow.mockRejectedValueOnce(
      Object.assign(new Error("rpc down"), { code: "CHAIN_ERROR" }),
    );

    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send({
        title: "Dinner",
        totalAmount: "120.00",
        payeeAddress: WALLET,
      });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("CHAIN_ERROR");
    expect(db.split.rows).toHaveLength(0);
  });

  it("rejects an invalid amount with 422", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send({ title: "Dinner", totalAmount: "12.5.5", payeeAddress: WALLET });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockEscrow.openSplitEscrow).not.toHaveBeenCalled();
  });

  it("rejects a malformed payee address with 422", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send({ title: "Dinner", totalAmount: "10", payeeAddress: "nope" });

    expect(res.status).toBe(422);
  });

  it("requires auth (401 in dev mode without the header)", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .send({ title: "Dinner", totalAmount: "10", payeeAddress: WALLET });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("GET /api/v1/splits/:id", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    mockEscrow.openSplitEscrow.mockClear();
  });

  it("returns 404 for an unknown split", async () => {
    const res = await request(app).get("/api/v1/splits/999").set(devHeaders());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 422 for a non-numeric id", async () => {
    const res = await request(app).get("/api/v1/splits/abc").set(devHeaders());
    expect(res.status).toBe(422);
  });
});
