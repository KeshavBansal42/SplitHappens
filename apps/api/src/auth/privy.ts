import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors.js";
import { getConfig } from "../config.js";
import { prisma } from "../db.js";
import { logger } from "../logger.js";

export type AuthedUser = {
  id: string;
  privyUserId: string;
  email: string | null;
  walletAddress: string | null;
  verifiedHuman: boolean;
};

let privyClient: import("@privy-io/server-auth").PrivyClient | null = null;

async function getPrivyClient() {
  if (!privyClient) {
    const { PrivyClient } = await import("@privy-io/server-auth");
    const config = getConfig();
    privyClient = new PrivyClient(config.PRIVY_APP_ID!, config.PRIVY_APP_SECRET!);
  }
  return privyClient;
}

async function upsertUser(
  privyUserId: string,
  walletAddress: string | null,
  email: string | null,
) {
  return prisma.user.upsert({
    where: { privyUserId },
    create: { privyUserId, walletAddress, email },
    update: {
      ...(walletAddress ? { walletAddress } : {}),
      ...(email ? { email } : {}),
    },
  });
}

type UserRow = {
  id: string;
  privyUserId: string;
  email: string | null;
  walletAddress: string | null;
  verifiedHuman: boolean;
};

function toAuthedUser(row: UserRow): AuthedUser {
  return {
    id: row.id,
    privyUserId: row.privyUserId,
    email: row.email,
    walletAddress: row.walletAddress,
    verifiedHuman: row.verifiedHuman,
  };
}

async function verifyPrivyToken(accessToken: string): Promise<AuthedUser> {
  let claims: { userId: string };
  try {
    const client = await getPrivyClient();
    claims = await client.verifyAuthToken(accessToken);
  } catch {
    throw new ApiError("UNAUTHORIZED", "Invalid or expired access token");
  }

  const existing = await prisma.user.findUnique({
    where: { privyUserId: claims.userId },
  });

  // The profile only needs fetching once. After that the local row has the
  // email + wallet we care about, so we skip the extra Privy round trip
  // (and its rate limits) on every request.
  if (existing?.email && existing.walletAddress) {
    return toAuthedUser(existing);
  }

  let email = existing?.email ?? null;
  let walletAddress = existing?.walletAddress ?? null;

  try {
    const client = await getPrivyClient();
    const privyUser = await client.getUserById(claims.userId);
    const linkedEmail = privyUser.email as { address?: string } | undefined;
    email = linkedEmail?.address?.toLowerCase() ?? email;
    walletAddress =
      (privyUser.wallet?.address as string | undefined)?.toLowerCase() ??
      walletAddress;
  } catch (err) {
    logger.warn({ err, privyUserId: claims.userId }, "could not load privy profile");
  }

  const user = await upsertUser(claims.userId, walletAddress, email);
  return toAuthedUser(user);
}

async function verifyDevHeaders(req: Request): Promise<AuthedUser> {
  const devUserId = req.header("x-dev-user-id");
  if (!devUserId) {
    throw new ApiError(
      "UNAUTHORIZED",
      "Missing x-dev-user-id header (AUTH_MODE=dev)",
    );
  }
  const email = req.header("x-dev-email")?.toLowerCase() ?? null;
  const user = await upsertUser(
    `dev:${devUserId}`,
    req.header("x-dev-wallet") ?? null,
    email,
  );
  return toAuthedUser(user);
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mode = getConfig().AUTH_MODE;
    if (mode === "dev") {
      req.user = await verifyDevHeaders(req);
    } else {
      const header = req.header("authorization");
      const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
      if (!token) {
        throw new ApiError("UNAUTHORIZED", "Missing Bearer token");
      }
      req.user = await verifyPrivyToken(token);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function logAuthModeWarning(): void {
  const mode = getConfig().AUTH_MODE;
  if (mode === "dev") {
    logger.warn(
      "AUTH_MODE=dev — request identity is trusted from headers. Local development only.",
    );
  }
}
