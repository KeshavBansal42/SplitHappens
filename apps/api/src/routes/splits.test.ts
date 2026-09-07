import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma } from "../test/fakePrisma.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

import { prisma } from "../db.js";

const db = prisma as unknown as FakePrisma;
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
  });

  it("creates a split and returns 201 with string amount and id", async () => {
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
  });

  it("rejects an invalid amount with 422", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .set(devHeaders())
      .send({ title: "Dinner", totalAmount: "12.5.5", payeeAddress: WALLET });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
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
