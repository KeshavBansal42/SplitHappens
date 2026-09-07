import { Router } from "express";
import { z } from "zod";
import {
  createSplitRequestSchema,
  createSplitResponseSchema,
  getSplitResponseSchema,
  joinSplitRequestSchema,
  joinSplitResponseSchema,
  paySplitRequestSchema,
  paySplitResponseSchema,
} from "@splithappens/shared";
import { requireAuth } from "../auth/privy.js";
import { ApiError } from "../errors.js";
import { prisma } from "../db.js";
import { openSplitEscrow } from "../chain/escrow.js";
import {
  getSplitOrThrow,
  joinSplit,
  paySplit,
  splitWithParticipants,
} from "../services/splits.js";
import {
  mapParticipant,
  mapSplitDetail,
} from "../services/serialize.js";
import { parseBody } from "./helpers.js";

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

      try {
        await openSplitEscrow(split.id, input.payeeAddress, input.totalAmount);
      } catch (err) {
        await prisma.split.delete({ where: { id: split.id } });
        if (err instanceof ApiError) throw err;
        throw new ApiError(
          "CHAIN_ERROR",
          "Failed to open the split on-chain",
        );
      }

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

  router.post("/:id/join", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const input = parseBody(joinSplitRequestSchema, req.body);
      const user = req.user!;

      await joinSplit(id, user.id, input.shareAmount);

      const body = joinSplitResponseSchema.parse({
        splitId: id.toString(),
        userId: user.id,
        shareAmount: input.shareAmount,
      });
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/pay", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const input = parseBody(paySplitRequestSchema, req.body);
      const user = req.user!;

      const participant = await paySplit(id, user.id, input.txHash, input.amount);
      res.json(paySplitResponseSchema.parse(mapParticipant(participant)));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
