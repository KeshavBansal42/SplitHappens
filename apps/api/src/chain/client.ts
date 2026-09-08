import {
  type Account,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getConfig } from "../config.js";
import { arcTestnet } from "./arc.js";

let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;
let releaserAccount: Account | null = null;
let releaserAddress: `0x${string}` | null = null;

export function getPublicClient(): PublicClient {
  const config = getConfig();
  publicClient ??= createPublicClient({
    chain: arcTestnet,
    transport: http(config.ARC_RPC_URL),
  });
  return publicClient;
}

export function getWalletClient(): WalletClient {
  const config = getConfig();
  if (!walletClient) {
    const account = privateKeyToAccount(config.RELEASER_PRIVATE_KEY as `0x${string}`);
    walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(config.ARC_RPC_URL),
    });
    releaserAccount = account;
    releaserAddress = account.address;
  }
  return walletClient;
}

export function getReleaserAccount(): Account {
  getWalletClient();
  return releaserAccount!;
}

export function getReleaserAddress(): `0x${string}` {
  getWalletClient();
  return releaserAddress!;
}
