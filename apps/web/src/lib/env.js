export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

export const ARC_RPC_URL =
  import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network';

export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS;

export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS;

// Optional escape hatch for local API work: when both are set the app talks
// to an AUTH_MODE=dev backend with header auth instead of Privy tokens.
export const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID;
export const DEV_WALLET = import.meta.env.VITE_DEV_WALLET;
export const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL;
