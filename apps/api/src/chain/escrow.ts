import { getTransactionReceipt, writeContract } from "viem/actions";
import { getConfig } from "../config.js";
import { getPublicClient, getReleaserAccount, getWalletClient } from "./client.js";
import { escrowAbi } from "./escrowAbi.js";
import { amountToUnits } from "./units.js";
import { ApiError } from "../errors.js";

export async function openSplitEscrow(
  splitId: bigint,
  payeeAddress: string,
  targetAmount: string,
): Promise<void> {
  const config = getConfig();
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const escrow = config.ESCROW_ADDRESS as `0x${string}`;

  const hash = await writeContract(walletClient, {
    address: escrow,
    abi: escrowAbi,
    functionName: "openSplit",
    args: [splitId, payeeAddress as `0x${string}`, amountToUnits(targetAmount)],
    account: getReleaserAccount(),
    chain: walletClient.chain,
  });

  const receipt = await getTransactionReceipt(publicClient, { hash });
  if (receipt.status !== "success") {
    throw new ApiError("CHAIN_ERROR", "openSplit transaction reverted on-chain");
  }
}
