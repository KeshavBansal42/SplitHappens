import { createPublicClient, http, type PublicClient } from "viem";
import { arcTestnet } from "./arc";
import { ARC_RPC_URL, USDC_ADDRESS } from "./env";

export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
}

export function usdcAddress(): `0x${string}` | undefined {
  return USDC_ADDRESS;
}
