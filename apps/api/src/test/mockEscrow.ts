import { vi } from "vitest";

export type VerifyOpenSplitCall = {
  splitId: bigint;
  txHash: string;
  payeeAddress: string;
  targetAmount: string;
};

export function createMockEscrow() {
  const calls: VerifyOpenSplitCall[] = [];

  const verifyOpenSplitTx = vi.fn(
    async (
      splitId: bigint,
      args: { txHash: string; payeeAddress: string; targetAmount: string },
    ) => {
      calls.push({ splitId, ...args });
    },
  );

  // By default the split is not on-chain yet, so the normal tx path runs.
  const readOpenSplit = vi.fn(
    async (): Promise<{ target: bigint; released: boolean } | null> => null,
  );

  return {
    calls,
    verifyOpenSplitTx,
    readOpenSplit,
    failNext(error: Error) {
      verifyOpenSplitTx.mockRejectedValueOnce(error);
    },
  };
}

export type MockEscrow = ReturnType<typeof createMockEscrow>;
