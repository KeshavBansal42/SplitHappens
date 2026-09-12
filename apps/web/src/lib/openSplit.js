import { encodeFunctionData } from 'viem';
import { api } from './api.js';
import { CHAIN_ID, amountToUnits, escrowAbi, escrowSplitExists } from './chain.js';
import { ESCROW_ADDRESS } from './env.js';

const DEV_TX_HASH = '0x' + '00'.repeat(32);

/**
 * Opens a split in the escrow from the caller's wallet.
 *
 * If the split is already registered on-chain we reconcile instead of
 * re-sending: the contract rejects a reused split id, and that used to look
 * like a mysterious gas error.
 */
export async function openSplitOnChain(split, { isDev, sendTransaction }) {
  if (isDev) {
    await api.openSplit(split.id, { txHash: DEV_TX_HASH });
    return;
  }

  if (await escrowSplitExists(split.id)) {
    await api.openSplit(split.id, {});
    return;
  }

  const data = encodeFunctionData({
    abi: escrowAbi,
    functionName: 'openSplit',
    args: [
      BigInt(split.id),
      split.payeeAddress,
      amountToUnits(split.totalAmountRaw ?? split.totalAmount),
    ],
  });

  const receipt = await sendTransaction({
    to: ESCROW_ADDRESS,
    data,
    chainId: CHAIN_ID,
  });

  await api.openSplit(split.id, { txHash: receipt.transactionHash });
}
