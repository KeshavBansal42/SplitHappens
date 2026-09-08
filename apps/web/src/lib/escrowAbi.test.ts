import { describe, expect, it } from "vitest";
import { encodeFunctionData, decodeFunctionData } from "viem";
import { escrowAbi } from "./escrowAbi";
import { usdcAbi } from "./usdcAbi";
import { amountToUnits } from "./units";

describe("escrow deposit encoding", () => {
  it("encodes deposit(splitId, amount) that decodes back", () => {
    const splitId = 7n;
    const amount = amountToUnits("42.50");

    const data = encodeFunctionData({
      abi: escrowAbi,
      functionName: "deposit",
      args: [splitId, amount],
    });

    const decoded = decodeFunctionData({ abi: escrowAbi, data });
    expect(decoded.functionName).toBe("deposit");
    expect(decoded.args).toEqual([splitId, amount]);
  });

  it("encodes release(splitId)", () => {
    const data = encodeFunctionData({
      abi: escrowAbi,
      functionName: "release",
      args: [3n],
    });
    const decoded = decodeFunctionData({ abi: escrowAbi, data });
    expect(decoded.functionName).toBe("release");
    expect(decoded.args).toEqual([3n]);
  });
});

describe("usdc approve encoding", () => {
  it("encodes approve(escrow, amount) that decodes back", () => {
    const escrow = "0x2222222222222222222222222222222222222222";
    const amount = amountToUnits("42.50");

    const data = encodeFunctionData({
      abi: usdcAbi,
      functionName: "approve",
      args: [escrow, amount],
    });

    const decoded = decodeFunctionData({ abi: usdcAbi, data });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([escrow, amount]);
  });
});
