import { type PublicClient, createPublicClient, http } from "viem";
import { getConfig } from "../config.js";
import { arcTestnet } from "./arc.js";

let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  const config = getConfig();
  publicClient ??= createPublicClient({
    chain: arcTestnet,
    transport: http(config.ARC_RPC_URL),
  });
  return publicClient;
}
