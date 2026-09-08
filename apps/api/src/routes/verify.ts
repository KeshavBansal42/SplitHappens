import { Router } from "express";
import { verifyRequestSchema, verifyResponseSchema } from "@splithappens/shared";
import { requireAuth } from "../auth/privy.js";
import { prisma } from "../db.js";

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
