import { readContract } from "viem/actions";
import { getConfig } from "../config.js";
import { getPublicClient } from "./client.js";
import { escrowAbi, type EscrowStatus } from "./escrowAbi.js";

export async function getEscrowStatus(splitId: bigint): Promise<EscrowStatus> {
  const publicClient = getPublicClient();
  const config = getConfig();

  const [collected, target, released] = await readContract(publicClient, {
    address: config.ESCROW_ADDRESS as `0x${string}`,
    abi: escrowAbi,
    functionName: "getSplitStatus",
    args: [splitId],
  });

  return { collected, target, released };
}
