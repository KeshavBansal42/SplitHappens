import { defineChain } from "viem";
import { ARC_RPC_URL } from "./env";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
  },
});
