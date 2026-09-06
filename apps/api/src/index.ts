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

async function main(): Promise<void> {
  const config = getConfig();

  await prisma.$connect();
  logger.info("database connected");

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(`api listening on http://localhost:${config.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    server.close();
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
