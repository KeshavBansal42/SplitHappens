import { describe, expect, it, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma } from "../test/fakePrisma.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("../chain/escrow.js", async () => {
  const { createMockEscrow } = await import("../test/mockEscrow.js");
  const mock = createMockEscrow();
  return {
    verifyOpenSplitTx: mock.verifyOpenSplitTx,
    readOpenSplit: mock.readOpenSplit,
  };
});

import { prisma } from "../db.js";

const db = prisma as unknown as FakePrisma;
const app = createApp();

function createBody(wallet: string) {
  return {
    title: "X",
    totalAmount: "10",
    payeeAddress: wallet,
    participantCount: 2,
    invites: [{ email: "friend@example.com" }],
  };
}

describe("auth: dev mode header path", () => {
  beforeEach(() => {
    db.user.clear();
    db.split.clear();
    db.splitParticipant.clear();
    db.splitInvite.clear();
  });

  it("rejects requests without an x-dev-user-id header", async () => {
    const res = await request(app)
      .post("/api/v1/splits")
      .send(createBody("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("upserts the dev user on first request", async () => {
    const wallet = "0xcccccccccccccccccccccccccccccccccccccccc";
    const res = await request(app)
      .post("/api/v1/splits")
      .set("x-dev-user-id", "carol")
      .set("x-dev-wallet", wallet)
      .send(createBody(wallet));

    expect(res.status).toBe(201);
    const users = db.user.rows;
    expect(users).toHaveLength(1);
    expect(users[0]?.privyUserId).toBe("dev:carol");
    expect(users[0]?.walletAddress).toBe(wallet);
  });

  it("reuses the same user row across requests", async () => {
    const wallet = "0xdddddddddddddddddddddddddddddddddddddddd";
    const headers = { "x-dev-user-id": "dave", "x-dev-wallet": wallet };
    await request(app)
      .post("/api/v1/splits")
      .set(headers)
      .send(createBody(wallet));
    const res = await request(app)
      .post("/api/v1/splits")
      .set(headers)
      .send({ ...createBody(wallet), title: "B" });

    expect(res.status).toBe(201);
    expect(db.user.rows).toHaveLength(1);
  });
});
