import { Router } from "express";
import { z } from "zod";
import { splitStatusResponseSchema } from "@splitstream/shared";
import { requireAuth } from "../auth/privy.js";
import { ApiError } from "../errors.js";
import { getSplitOrThrow } from "../services/splits.js";
import { mapParticipant, mapSplitStatus } from "../services/serialize.js";
import { decimalToUnits, unitsToAmount } from "../chain/units.js";
import { getEscrowStatus } from "../chain/reader.js";

function parseId(raw: string): bigint {
  const parsed = z.coerce.bigint().positive().safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "Split id must be a positive integer");
  }
  return parsed.data;
}

/**
 * GET /splits/:id/status
 *
 * Live view used by the dashboard poll: the db record merged with the
 * escrow's on-chain collected/target/released state. The chain is the
 * source of truth for payment progress; the db adds participant rows,
 * wallet addresses, and per-participant confirmation state.
 *
 * The on-chain read is best-effort: a split that exists locally but has
 * never been touched on-chain reports zeros rather than erroring.
 */
export function statusRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/splits/:id/status", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const split = await getSplitOrThrow(id);

      let onChain = { collected: 0n, target: 0n, released: false };
      try {
        onChain = await getEscrowStatus(id);
      } catch (err) {
        req.log?.warn({ err, splitId: id.toString() }, "on-chain status read failed");
      }

      const totalUnits = decimalToUnits(split.totalAmount);
      const body = splitStatusResponseSchema.parse({
        split: {
          id: split.id.toString(),
          title: split.title,
          status: mapSplitStatus(split.status),
          totalAmount: unitsToAmount(totalUnits),
          payeeAddress: split.payeeAddress,
          requireVerification: split.requireVerification,
        },
        onChain: {
          collected: unitsToAmount(onChain.collected),
          target: unitsToAmount(onChain.target),
          released: onChain.released,
        },
        participants: split.participants.map(mapParticipant),
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
