import { Router } from "express";
import { z } from "zod";
import {
  addInvitesRequestSchema,
  createSplitRequestSchema,
  createSplitResponseSchema,
  getSplitResponseSchema,
  invitedSplitsResponseSchema,
  joinSplitResponseSchema,
  mySplitsResponseSchema,
  openSplitRequestSchema,
  paySplitRequestSchema,
  paySplitResponseSchema,
} from "@splithappens/shared";
import { requireAuth } from "../auth/privy.js";
import { ApiError } from "../errors.js";
import {
  addInvites,
  createSplit,
  getSplitOrThrow,
  joinSplit,
  listInvited,
  listMine,
  markSplitOpened,
  paySplit,
} from "../services/splits.js";
import {
  mapParticipant,
  mapSplitDetail,
  mapSplitSummary,
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
      const user = req.user!;

      const split = await createSplit(user.id, {
        title: input.title,
        totalAmount: input.totalAmount,
        payeeAddress: input.payeeAddress,
        participantCount: input.participantCount,
        inviteEmails: input.invites.map((i) => i.email),
        requireVerification: input.requireVerification ?? false,
      });

      const body = createSplitResponseSchema.parse(mapSplitDetail(split, user.id));
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get("/invited", async (req, res, next) => {
    try {
      const user = req.user!;
      if (!user.email) {
        res.json(invitedSplitsResponseSchema.parse({ viewerId: user.id, splits: [] }));
        return;
      }
      const invites = await listInvited(user.email);
      const body = invitedSplitsResponseSchema.parse({
        viewerId: user.id,
        splits: invites.map((invite) =>
          mapSplitSummary(invite.split, invite.shareAmount),
        ),
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get("/mine", async (req, res, next) => {
    try {
      const user = req.user!;
      const splits = await listMine(user.id);
      const body = mySplitsResponseSchema.parse({
        viewerId: user.id,
        splits: splits.map(({ split, shareAmount }) =>
          mapSplitSummary(split, shareAmount),
        ),
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const user = req.user!;
      const split = await getSplitOrThrow(id);
      res.json(getSplitResponseSchema.parse(mapSplitDetail(split, user.id)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/open", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const input = parseBody(openSplitRequestSchema, req.body);
      const user = req.user!;

      const existing = await getSplitOrThrow(id);
      if (existing.creatorId !== user.id) {
        throw new ApiError("FORBIDDEN", "Only the split creator can open it");
      }

      const split = await markSplitOpened(id, input.txHash);
      res.json(getSplitResponseSchema.parse(mapSplitDetail(split, user.id)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/invites", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const input = parseBody(addInvitesRequestSchema, req.body);
      const user = req.user!;

      const split = await addInvites(id, user.id, input.emails);
      res.json(getSplitResponseSchema.parse(mapSplitDetail(split, user.id)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/join", async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const user = req.user!;

      if (!user.email) {
        throw new ApiError(
          "FORBIDDEN",
          "No email on your account, so we cannot match an invite",
        );
      }

      const shareAmount = await joinSplit(id, user.id, user.email);

      const body = joinSplitResponseSchema.parse({
        splitId: id.toString(),
        userId: user.id,
        shareAmount,
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
