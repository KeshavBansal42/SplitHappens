export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as
  | string
  | undefined;

export const ARC_RPC_URL =
  (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ??
  "https://rpc.testnet.arc.network";

export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as
  | `0x${string}`
  | undefined;

export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS as
  | `0x${string}`
  | undefined;
