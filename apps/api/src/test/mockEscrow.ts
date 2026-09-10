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

  return {
    calls,
    verifyOpenSplitTx,
    failNext(error: Error) {
      verifyOpenSplitTx.mockRejectedValueOnce(error);
    },
  };
}

export type MockEscrow = ReturnType<typeof createMockEscrow>;
