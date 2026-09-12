const runtimeConfig =
  (typeof window !== 'undefined' && window.__SPLITHAPPENS_CONFIG__) || {};

function read(key, fallback) {
  return runtimeConfig[key] || import.meta.env[key] || fallback;
}

export const PRIVY_APP_ID = read('VITE_PRIVY_APP_ID');

export const ARC_RPC_URL = read(
  'VITE_ARC_RPC_URL',
  'https://rpc.testnet.arc.network'
);

export const USDC_ADDRESS = read('VITE_USDC_ADDRESS');

export const ESCROW_ADDRESS = read('VITE_ESCROW_ADDRESS');

// Optional escape hatch for local API work: when both are set the app talks
// to an AUTH_MODE=dev backend with header auth instead of Privy tokens.
export const DEV_USER_ID = read('VITE_DEV_USER_ID');
export const DEV_WALLET = read('VITE_DEV_WALLET');
export const DEV_EMAIL = read('VITE_DEV_EMAIL');
