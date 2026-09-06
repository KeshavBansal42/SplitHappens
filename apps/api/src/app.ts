import express from "express";
import { pinoHttp } from "pino-http";
import { errorHandler, notFoundHandler } from "./errors.js";
import { logger } from "./logger.js";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
