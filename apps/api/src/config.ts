import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1),

  // Privy server-side auth. Required when AUTH_MODE=privy (the default).
  AUTH_MODE: z.enum(["privy", "dev"]).default("privy"),
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),

  // Arc testnet
  ARC_RPC_URL: z.string().url().default("https://rpc.testnet.arc.network"),
  ARC_CHAIN_ID: z.coerce.number().int().positive().default(5042002),

  // Escrow contract + USDC on Arc testnet. Wallet addresses are
  // lowercased 0x-hex; the private key is the backend's release wallet,
  // which must hold a little testnet USDC to pay for gas.
  USDC_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "USDC_ADDRESS must be a 0x address")
    .transform((v) => v.toLowerCase()),
  ESCROW_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "ESCROW_ADDRESS must be a 0x address")
    .transform((v) => v.toLowerCase()),
  RELEASER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "RELEASER_PRIVATE_KEY must be a 0x-hex key"),

  WATCH_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  CONFIRM_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
});

function loadEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const env = parsed.data;

  // Privy credentials are required unless dev auth is explicitly enabled.
  if (env.AUTH_MODE === "privy" && (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET)) {
    throw new Error(
      "Invalid environment configuration:\n" +
        "  - PRIVY_APP_ID / PRIVY_APP_SECRET are required when AUTH_MODE=privy " +
        "(set AUTH_MODE=dev to run without Privy for local development)",
    );
  }

  return env;
}

export type Config = ReturnType<typeof loadEnv>;

let config: Config | undefined;

/** Loads and caches validated environment configuration. */
export function getConfig(): Config {
  config ??= loadEnv();
  return config;
}
