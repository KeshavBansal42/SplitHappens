import { Router } from "express";
import { verifyRequestSchema, verifyResponseSchema } from "@splitstream/shared";
import { requireAuth } from "../auth/privy.js";
import { prisma } from "../db.js";

/**
 * POST /api/v1/verify — World Selfie Check (stretch).
 *
 * The proof itself is produced by the World Sandbox App on the client; the
 * backend records that the caller passed, which gates the Pay button for
 * splits marked requireVerification. Additive and inert until used.
 */
export function verifyRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.post("/verify", async (req, res, next) => {
    try {
      verifyRequestSchema.parse(req.body);
      const user = req.user!;

      await prisma.user.update({
        where: { id: user.id },
        data: { verifiedHuman: true },
      });

      res.json(verifyResponseSchema.parse({ verifiedHuman: true }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
