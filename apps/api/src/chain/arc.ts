/**
 * Arc testnet chain config (chain id 5042002). Gas is paid in USDC.
 * The RPC URL is configurable for local forks (used by e2e tests).
 */

import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    // Arc's native gas asset is USDC, but viem requires a symbol/decimals
    // tuple; the escrow flow transfers USDC directly via the token contract.
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});
