import { Prisma } from "@prisma/client";
import { vi } from "vitest";

export type Row = { id: string | bigint } & Record<string, unknown>;

type Delegate = {
  rows: Row[];
  findUnique: ReturnType<typeof vi.fn>;
  findUniqueOrThrow: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  seed: (rows: Row[]) => void;
  clear: () => void;
};

function makeDelegate(): Delegate {
  const holder: { current: Row[] } = { current: [] };
  let nextBigInt = 1n;
  let nextCuid = 1n;

  const byId = (where: { id?: string | bigint }) =>
    holder.current.find((r) => r.id === where.id);

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
    const inviteCompound = where.splitId_email as { splitId?: bigint; email?: string } | undefined;
    if (inviteCompound) {
      return holder.current.find(
        (r) =>
          r.splitId === inviteCompound.splitId && r.email === inviteCompound.email,
      );
    }
    return undefined;
  };

  const ensureId = (data: Row): void => {
    if (data.id === undefined) {
      if ("totalAmount" in data) {
        data.id = nextBigInt++;
        data.createdAt ??= new Date();
        data.updatedAt ??= new Date();
        data.status ??= "PENDING";
        data.openedAt ??= null;
        data.openTxHash ??= null;
        data.releaseTxHash ??= null;
        data.releasedAt ??= null;
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
    findUniqueOrThrow: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = matchWhere(where);
      if (!row) throw new Error("findUniqueOrThrow: row not found");
      return row;
    }),
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
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
      if (where?.openedAt && typeof where.openedAt === "object") {
        const notVal = (where.openedAt as { not?: unknown }).not;
        if (notVal !== undefined) {
          return holder.current.filter((r) => r.openedAt !== notVal);
        }
      }
      if (where?.paid !== undefined) {
        return holder.current.filter((r) => r.paid === where.paid);
      }
      if (where?.userId !== undefined) {
        return holder.current.filter((r) => r.userId === where.userId);
      }
      if (where?.email !== undefined) {
        return holder.current.filter((r) => r.email === where.email);
      }
      if (where?.claimedByUserId === null) {
        return holder.current.filter(
          (r) => r.claimedByUserId === null || r.claimedByUserId === undefined,
        );
      }
      return holder.current;
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      ensureId(data);
      const nestedParticipant = (data as { participants?: { create?: Row | Row[] } }).participants;
      const nestedInvites = (data as { invites?: { create?: Row | Row[] } }).invites;
      if (nestedParticipant?.create) {
        const rows = Array.isArray(nestedParticipant.create)
          ? nestedParticipant.create
          : [nestedParticipant.create];
        (data as Row).participants = rows.map((r) => {
          const row = {
            ...r,
            splitId: data.id,
            user: { walletAddress: null },
            paid: r.paid ?? false,
            txHash: r.txHash ?? null,
            confirmedAt: r.confirmedAt ?? null,
          };
          ensureId(row);
          return row;
        });
      }
      if (nestedInvites?.create) {
        const rows = Array.isArray(nestedInvites.create)
          ? nestedInvites.create
          : [nestedInvites.create];
        (data as Row).invites = rows.map((r) => {
          const row = { ...r, splitId: data.id, claimedByUserId: r.claimedByUserId ?? null };
          ensureId(row);
          return row;
        });
      }
      holder.current.push(data);
      return data;
    }),
    createMany: vi.fn(async ({ data }: { data: Row[] }) => {
      for (const item of data) {
        ensureId(item);
        holder.current.push(item);
      }
      return { count: data.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string | bigint }; data: Partial<Row> }) => {
      const row = byId(where);
      if (!row) throw new Error("update: row not found");
      Object.assign(row, data);
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string | bigint } }) => {
      const index = holder.current.findIndex((r) => r.id === where.id);
      if (index === -1) throw new Error("delete: row not found");
      const [removed] = holder.current.splice(index, 1);
      return removed;
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
      delegate.findUniqueOrThrow.mockClear();
      delegate.findMany.mockClear();
      delegate.create.mockClear();
      delegate.createMany.mockClear();
      delegate.update.mockClear();
      delegate.delete.mockClear();
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
    splitInvite: makeDelegate(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) =>
    fn(db),
  );
  return db;
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
