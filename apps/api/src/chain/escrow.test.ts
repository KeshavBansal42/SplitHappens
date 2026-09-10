import { describe, expect, it, vi, beforeEach } from "vitest";
import { encodeFunctionData } from "viem";
import { escrowAbi } from "./escrowAbi.js";

const hoisted = vi.hoisted(() => {
  const state = {
    receipt: null as Record<string, unknown> | null,
    tx: null as Record<string, unknown> | null,
    receiptThrows: false,
  };
  return {
    state,
    stub: {
      getTransactionReceipt: async () => {
        if (state.receiptThrows) throw new Error("not found");
        return state.receipt;
      },
      getTransaction: async () => state.tx,
    },
  };
});

vi.mock("./client.js", () => ({
  getPublicClient: () => ({}),
}));

vi.mock("viem/actions", () => ({
  getTransactionReceipt: () => hoisted.stub.getTransactionReceipt(),
  getTransaction: () => hoisted.stub.getTransaction(),
}));

import { verifyOpenSplitTx } from "./escrow.js";

const ESCROW = "0x2222222222222222222222222222222222222222";
const PAYEE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX_HASH = "0x" + "cd".repeat(32);
const SPLIT_ID = 1000n;
const TARGET = "120.00";

function encodeOpen(splitId: bigint, payee: string, target: bigint) {
  return encodeFunctionData({
    abi: escrowAbi,
    functionName: "openSplit",
    args: [splitId, payee as `0x${string}`, target],
  });
}

function units(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole!) * 10n ** 6n + BigInt((frac + "000000").slice(0, 6));
}

beforeEach(() => {
  hoisted.state.receipt = { status: "success", to: ESCROW, from: PAYEE };
  hoisted.state.tx = {
    input: encodeOpen(SPLIT_ID, PAYEE, units(TARGET)),
  };
  hoisted.state.receiptThrows = false;
});

describe("verifyOpenSplitTx", () => {
  it("accepts a matching, successful open transaction", async () => {
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a tx sent somewhere other than the escrow", async () => {
    hoisted.state.receipt = {
      status: "success",
      to: "0x9999999999999999999999999999999999999999",
      from: PAYEE,
    };
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).rejects.toMatchObject({ code: "CHAIN_ERROR" });
  });

  it("rejects a reverted transaction", async () => {
    hoisted.state.receipt = { status: "reverted", to: ESCROW, from: PAYEE };
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).rejects.toMatchObject({ code: "CHAIN_ERROR" });
  });

  it("rejects a different split id", async () => {
    hoisted.state.tx = { input: encodeOpen(999n, PAYEE, units(TARGET)) };
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).rejects.toMatchObject({ code: "CHAIN_ERROR" });
  });

  it("rejects a different target amount", async () => {
    hoisted.state.tx = { input: encodeOpen(SPLIT_ID, PAYEE, units("99.00")) };
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).rejects.toMatchObject({ code: "CHAIN_ERROR" });
  });

  it("rejects a different payee", async () => {
    const other = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    hoisted.state.tx = { input: encodeOpen(SPLIT_ID, other, units(TARGET)) };
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).rejects.toMatchObject({ code: "CHAIN_ERROR" });
  });

  it("rejects when the transaction cannot be read", async () => {
    hoisted.state.receiptThrows = true;
    await expect(
      verifyOpenSplitTx(SPLIT_ID, {
        txHash: TX_HASH,
        payeeAddress: PAYEE,
        targetAmount: TARGET,
      }),
    ).rejects.toMatchObject({ code: "CHAIN_ERROR" });
  });
});
