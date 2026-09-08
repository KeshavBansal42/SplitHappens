import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { createApp } from "../app.js";
import { createFakePrisma, type FakePrisma, type Row } from "../test/fakePrisma.js";

vi.mock("../db.js", async () => {
  const { createFakePrisma } = await import("../test/fakePrisma.js");
  return { prisma: createFakePrisma() };
});

// The status route reads on-chain state through chain/reader.ts; stub it to
// avoid network access. It must be mocked before app import via vi.mock,
// but the app imports the route which imports reader at module scope.
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
        status: "PENDING",
        releaseTxHash: null,
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      } as unknown as Row,
    ]);

    const res = await request(app)
      .get("/api/v1/splits/1/status")
      .set({ "x-dev-user-id": "alice", "x-dev-wallet": WALLET });

    expect(res.status).toBe(200);
    expect(res.body.split).toMatchObject({ id: "1", status: "pending" });
    expect(res.body.onChain).toEqual({ collected: "0", target: "0", released: false });
    expect(res.body.participants).toEqual([]);
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
        status: "PARTIALLY_PAID",
        releaseTxHash: null,
        releasedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
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
