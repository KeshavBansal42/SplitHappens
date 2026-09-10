import { z } from "zod";

export const splitStatusSchema = z.enum([
  "pending",
  "partially_paid",
  "released",
]);

export type SplitStatus = z.infer<typeof splitStatusSchema>;

export const amountStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "amount must be a decimal string with up to 6 dp")
  .refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }, "amount must be greater than zero");

export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x ethereum address")
  .transform((v) => v.toLowerCase());

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x transaction hash")
  .transform((v) => v.toLowerCase());

const dateTimeSchema = z.string().datetime({ offset: true });

export const emailSchema = z
  .string()
  .trim()
  .email("must be a valid email")
  .transform((v) => v.toLowerCase());

export const participantSchema = z.object({
  id: z.string(),
  userId: z.string(),
  walletAddress: z.string().nullable(),
  shareAmount: z.string(),
  paid: z.boolean(),
  txHash: z.string().nullable(),
  confirmedAt: dateTimeSchema.nullable(),
});

export type Participant = z.infer<typeof participantSchema>;

export const inviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  shareAmount: z.string(),
  claimed: z.boolean(),
});

export type SplitInvite = z.infer<typeof inviteSchema>;

export const createSplitRequestSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(120),
    totalAmount: amountStringSchema,
    payeeAddress: evmAddressSchema,
    participantCount: z.number().int().min(2, "a split needs at least two people"),
    invites: z
      .array(z.object({ email: emailSchema }))
      .max(100, "too many invites"),
    requireVerification: z.boolean().optional(),
  })
  .refine((v) => v.invites.length === v.participantCount - 1, {
    message: "invites must equal participantCount minus one",
    path: ["invites"],
  });

export type CreateSplitRequest = z.infer<typeof createSplitRequestSchema>;

export const createSplitResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalAmount: z.string(),
  payeeAddress: z.string(),
  requireVerification: z.boolean(),
  participantCount: z.number().int(),
  status: splitStatusSchema,
  createdAt: dateTimeSchema,
  participants: z.array(participantSchema),
  invites: z.array(inviteSchema),
});

export type CreateSplitResponse = z.infer<typeof createSplitResponseSchema>;

export const splitDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalAmount: z.string(),
  payeeAddress: z.string(),
  requireVerification: z.boolean(),
  participantCount: z.number().int(),
  status: splitStatusSchema,
  releaseTxHash: z.string().nullable(),
  releasedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  participants: z.array(participantSchema),
  invites: z.array(inviteSchema),
});

export type SplitDetail = z.infer<typeof splitDetailSchema>;

export const getSplitResponseSchema = splitDetailSchema;
export type GetSplitResponse = SplitDetail;

export const listSplitsResponseSchema = z.array(splitDetailSchema);
export type ListSplitsResponse = z.infer<typeof listSplitsResponseSchema>;

export const joinSplitRequestSchema = z.object({});

export type JoinSplitRequest = z.infer<typeof joinSplitRequestSchema>;

export const joinSplitResponseSchema = z.object({
  splitId: z.string(),
  userId: z.string(),
  shareAmount: z.string(),
});

export type JoinSplitResponse = z.infer<typeof joinSplitResponseSchema>;

export const addInvitesRequestSchema = z.object({
  emails: z.array(emailSchema).min(1, "at least one email is required"),
});

export type AddInvitesRequest = z.infer<typeof addInvitesRequestSchema>;

export const paySplitRequestSchema = z.object({
  txHash: txHashSchema,
  amount: amountStringSchema,
});

export type PaySplitRequest = z.infer<typeof paySplitRequestSchema>;

export const paySplitResponseSchema = participantSchema;
export type PaySplitResponse = Participant;

export const splitStatusResponseSchema = z.object({
  split: z.object({
    id: z.string(),
    title: z.string(),
    status: splitStatusSchema,
    totalAmount: z.string(),
    payeeAddress: z.string(),
    requireVerification: z.boolean(),
    participantCount: z.number().int(),
  }),
  onChain: z.object({
    collected: z.string(),
    target: z.string(),
    released: z.boolean(),
  }),
  participants: z.array(participantSchema),
  invites: z.array(inviteSchema),
});

export type SplitStatusResponse = z.infer<typeof splitStatusResponseSchema>;

export const verifyRequestSchema = z.object({
  proofToken: z.string().trim().min(1, "proofToken is required"),
});

export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const verifyResponseSchema = z.object({
  verifiedHuman: z.literal(true),
});

export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  details: z.unknown().optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
