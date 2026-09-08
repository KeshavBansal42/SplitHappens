/**
 * In-memory fake prisma used by route/service unit tests.
 *
 * Each test file mocks the db module (see route tests for the pattern):
 *
 *   vi.mock("../db.js", async () => {
 *     const { createFakePrisma } = await import("./test/fakePrisma.js");
 *     return { prisma: createFakePrisma() };
 *   });
 *
 * Delegates keep an internal `rows` array; the query methods mirror the
 * subset of behavior the routes rely on. Tests seed rows via `seed()`
 * and assert on `rows` / delegate mocks.
 */

import { Prisma } from "@prisma/client";
import { vi } from "vitest";

export type Row = { id: string | bigint } & Record<string, unknown>;

type Delegate = {
  rows: Row[];
  findUnique: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  seed: (rows: Row[]) => void;
  clear: () => void;
};

function makeDelegate(): Delegate {
  // Single mutable holder so seed()/clear() replacement stays visible to
  // every closure below.
  const holder: { current: Row[] } = { current: [] };
  let nextBigInt = 1n;
  let nextCuid = 1n;

  const byId = (where: { id?: string | bigint }) =>
    holder.current.find((r) => r.id === where.id);

  // Match rows against a prisma-style `where` (id, privyUserId, or the
  // compound splitId_userId key) for findUnique.
  const matchWhere = (where: Record<string, unknown>): Row | undefined => {
    if (where.id !== undefined) {
      return holder.current.find((r) => r.id === where.id);
    }
    if (where.privyUserId !== undefined) {
      return holder.current.find((r) => r.privyUserId === where.privyUserId);
    }
    const compound = where.splitId_userId as { splitId?: bigint; userId?: string } | undefined;
    if (compound) {
      return holder.current.find(
        (r) =>
          r.splitId === compound.splitId && r.userId === compound.userId,
      );
    }
    return undefined;
  };

  // Mirror DB @default(cuid()): users and participants get a string id.
  const ensureId = (data: Row): void => {
    if (data.id === undefined) {
      if ("totalAmount" in data) {
        data.id = nextBigInt++;
        data.createdAt ??= new Date();
        data.updatedAt ??= new Date();
        data.status ??= "PENDING";
      } else {
        data.id = `cuid_${(nextCuid++).toString()}`;
        data.createdAt ??= new Date();
        data.updatedAt ??= new Date();
      }
    }
  };

  const delegate: Delegate = {
    rows: holder.current,
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      matchWhere(where) ?? null,
    ),
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
      // Minimal where support: status not-equals (release watcher) and
      // compound filters used by route tests.
      if (where?.status && typeof where.status === "object") {
        const notVal = (where.status as { not?: string }).not;
        if (notVal !== undefined) {
          return holder.current.filter((r) => r.status !== notVal);
        }
      }
      if (where?.txHash && typeof where.txHash === "object") {
        const notVal = (where.txHash as { not?: unknown }).not;
        if (notVal !== undefined) {
          return holder.current.filter((r) => r.txHash !== notVal);
        }
      }
      if (where?.paid !== undefined) {
        return holder.current.filter((r) => r.paid === where.paid);
      }
      return holder.current;
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      ensureId(data);
      holder.current.push(data);
      return data;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string | bigint }; data: Partial<Row> }) => {
      const row = byId(where);
      if (!row) throw new Error("update: row not found");
      Object.assign(row, data);
      return row;
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { privyUserId: string };
        create: Row;
        update: Partial<Row>;
      }) => {
        const existing = holder.current.find((r) => r.privyUserId === where.privyUserId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        ensureId(create);
        holder.current.push(create);
        return create;
      },
    ),
    aggregate: vi.fn(
      async ({
        _sum,
      }: {
        _sum: { shareAmount?: boolean };
      }): Promise<{ _sum: { shareAmount: unknown } }> => {
        if (_sum.shareAmount) {
          const total = holder.current.reduce(
            (acc, r) => {
              const amount = r.shareAmount as { toFixed?: () => string } | null;
              return acc.plus(amount?.toFixed ? new Prisma.Decimal(amount.toFixed()) : new Prisma.Decimal(0));
            },
            new Prisma.Decimal(0),
          );
          return { _sum: { shareAmount: total } };
        }
        return { _sum: { shareAmount: null } };
      },
    ),
    seed: (seedRows) => {
      holder.current = [...seedRows];
      delegate.rows = holder.current;
    },
    clear: () => {
      holder.current = [];
      delegate.rows = holder.current;
      delegate.findUnique.mockClear();
      delegate.findMany.mockClear();
      delegate.create.mockClear();
      delegate.update.mockClear();
      delegate.upsert.mockClear();
      delegate.aggregate.mockClear();
    },
  };

  return delegate;
}

export function createFakePrisma() {
  const db = {
    user: makeDelegate(),
    split: makeDelegate(),
    splitParticipant: makeDelegate(),
    $transaction: vi.fn(),
  };
  // The interactive transaction callback receives the same fake as the tx
  // client so nested operations land in the same in-memory tables.
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) =>
    fn(db),
  );
  return db;
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
