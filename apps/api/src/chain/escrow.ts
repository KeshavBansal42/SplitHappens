import { getTransaction, getTransactionReceipt } from "viem/actions";
import { decodeFunctionData } from "viem/utils";
import { getConfig } from "../config.js";
import { getPublicClient } from "./client.js";
import { escrowAbi } from "./escrowAbi.js";
import { amountToUnits } from "./units.js";
import { ApiError } from "../errors.js";

export type VerifyOpenSplitArgs = {
  txHash: string;
  payeeAddress: string;
  targetAmount: string;
  from?: string | null;
};

/**
 * Confirms that a client-submitted transaction really called
 * openSplit(splitId, payee, target) on the escrow, and succeeded.
 * The backend no longer sends this itself — it only trusts what it can
 * re-derive from the receipt.
 */
export async function verifyOpenSplitTx(
  splitId: bigint,
  args: VerifyOpenSplitArgs,
): Promise<void> {
  const config = getConfig();
  const publicClient = getPublicClient();
  const escrow = config.ESCROW_ADDRESS as `0x${string}`;
  const hash = args.txHash as `0x${string}`;

  let receipt;
  let tx;
  try {
    receipt = await getTransactionReceipt(publicClient, { hash });
    tx = await getTransaction(publicClient, { hash });
  } catch {
    throw new ApiError("CHAIN_ERROR", "Could not read the open transaction");
  }

  const valid =
    receipt.status === "success" &&
    receipt.to?.toLowerCase() === escrow &&
    (!args.from || receipt.from.toLowerCase() === args.from.toLowerCase());

  if (!valid || !tx.input || tx.input === "0x") {
    throw new ApiError("CHAIN_ERROR", "Open transaction did not target the escrow");
  }

  let matches = false;
  try {
    const decoded = decodeFunctionData({
      abi: escrowAbi,
      data: tx.input as `0x${string}`,
    });
    if (decoded.functionName === "openSplit") {
      const [argSplitId, argPayee, argTarget] = decoded.args;
      matches =
        argSplitId === splitId &&
        argPayee.toLowerCase() === args.payeeAddress.toLowerCase() &&
        argTarget === amountToUnits(args.targetAmount);
    }
  } catch {
    matches = false;
  }

  if (!matches) {
    throw new ApiError(
      "CHAIN_ERROR",
      "Open transaction does not match this split",
    );
  }
}
