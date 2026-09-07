import { Router } from "express";
import { z } from "zod";
import {
  createSplitRequestSchema,
  createSplitResponseSchema,
  getSplitResponseSchema,
} from "@splithappens/shared";
import { requireAuth } from "../auth/privy.js";
import { ApiError } from "../errors.js";
import { prisma } from "../db.js";
import {
  getSplitOrThrow,
  splitWithParticipants,
} from "../services/splits.js";
import { mapSplitDetail } from "../services/serialize.js";

function parseId(raw: string): bigint {
  const parsed = z.coerce.bigint().positive().safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "Split id must be a positive integer");
  }
  return parsed.data;
}

export function splitsRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.post("/", async (req, res, next) => {
    try {
      const input = createSplitRequestSchema.parse(req.body);

      const split = await prisma.split.create({
        data: {
          title: input.title,
          totalAmount: input.totalAmount,
          payeeAddress: input.payeeAddress,
          requireVerification: input.requireVerification ?? false,
        },
        include: splitWithParticipants.include,
      });

      const body = createSplitResponseSchema.parse({
        id: split.id.toString(),
        title: split.title,
        totalAmount: split.totalAmount.toString(),
        payeeAddress: split.payeeAddress,
        requireVerification: split.requireVerification,
        status: "pending",
        createdAt: split.createdAt.toISOString(),
      });
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const split = await getSplitOrThrow(id);
      res.json(getSplitResponseSchema.parse(mapSplitDetail(split)));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
