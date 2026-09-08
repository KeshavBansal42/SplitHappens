import { vi } from "vitest";

export function createMockEscrow() {
  const calls: Array<{ splitId: bigint; payeeAddress: string; targetAmount: string }> = [];

  const openSplitEscrow = vi.fn(
    async (splitId: bigint, payeeAddress: string, targetAmount: string) => {
      calls.push({ splitId, payeeAddress, targetAmount });
    },
  );

  return {
    calls,
    openSplitEscrow,
    failNext(error: Error) {
      openSplitEscrow.mockRejectedValueOnce(error);
    },
  };
}

export type MockEscrow = ReturnType<typeof createMockEscrow>;
