import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { prisma } from "./db.js";
import { createApp } from "./app.js";
import { logAuthModeWarning } from "./auth/privy.js";
import { startConfirmWatcher } from "./chain/confirm.js";
import { startReleaseWatcher } from "./chain/release.js";

async function main(): Promise<void> {
  const config = getConfig();
  logAuthModeWarning();

  await prisma.$connect();
  logger.info("database connected");

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(`api listening on http://localhost:${config.PORT}`);
  });

  const confirmWatcher = startConfirmWatcher();
  const releaseWatcher = startReleaseWatcher();
  logger.info(
    { confirmMs: config.CONFIRM_INTERVAL_MS, watchMs: config.WATCH_INTERVAL_MS },
    "chain watchers started",
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    server.close();
    await Promise.allSettled([confirmWatcher.stop(), releaseWatcher.stop()]);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
