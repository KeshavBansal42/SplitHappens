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
    update: email ? { email } : {},
  });
}

async function verifyPrivyToken(token: string): Promise<AuthedUser> {
  try {
    const client = await getPrivyClient();
    const claims = await client.verifyAuthToken(token);

    let email: string | null = null;
    try {
      const privyUser = await client.getUser({ idToken: token });
      const linked = privyUser.email as { address?: string } | undefined;
      email = linked?.address?.toLowerCase() ?? null;
    } catch {
      email = null;
    }

    const user = await upsertUser(claims.userId, null, email);
    return {
      id: user.id,
      privyUserId: user.privyUserId,
      email: user.email,
      walletAddress: user.walletAddress,
      verifiedHuman: user.verifiedHuman,
    };
  } catch {
    throw new ApiError("UNAUTHORIZED", "Invalid or expired access token");
  }
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
  return {
    id: user.id,
    privyUserId: user.privyUserId,
    email: user.email,
    walletAddress: user.walletAddress,
    verifiedHuman: user.verifiedHuman,
  };
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
