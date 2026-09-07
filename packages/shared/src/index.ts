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

export const createSplitRequestSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(120),
  totalAmount: amountStringSchema,
  payeeAddress: evmAddressSchema,
  requireVerification: z.boolean().optional(),
});

export type CreateSplitRequest = z.infer<typeof createSplitRequestSchema>;

export const createSplitResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalAmount: z.string(),
  payeeAddress: z.string(),
  requireVerification: z.boolean(),
  status: splitStatusSchema,
  createdAt: dateTimeSchema,
});

export type CreateSplitResponse = z.infer<typeof createSplitResponseSchema>;

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

export const splitDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalAmount: z.string(),
  payeeAddress: z.string(),
  requireVerification: z.boolean(),
  status: splitStatusSchema,
  releaseTxHash: z.string().nullable(),
  releasedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  participants: z.array(participantSchema),
});

export type SplitDetail = z.infer<typeof splitDetailSchema>;

export const getSplitResponseSchema = splitDetailSchema;
export type GetSplitResponse = SplitDetail;

export const joinSplitRequestSchema = z.object({
  shareAmount: amountStringSchema,
});

export type JoinSplitRequest = z.infer<typeof joinSplitRequestSchema>;

export const joinSplitResponseSchema = z.object({
  splitId: z.string(),
  userId: z.string(),
  shareAmount: z.string(),
});

export type JoinSplitResponse = z.infer<typeof joinSplitResponseSchema>;

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
  }),
  onChain: z.object({
    collected: z.string(),
    target: z.string(),
    released: z.boolean(),
  }),
  participants: z.array(
    participantSchema.extend({
      walletAddress: z.string().nullable(),
    }),
  ),
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
