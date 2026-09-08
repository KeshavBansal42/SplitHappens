import { describe, expect, it } from "vitest";
import { amountToUnits, unitsToAmount, USDC_DECIMALS } from "./units";
import { parseUnits, formatUnits } from "viem";

describe("units", () => {
  it("matches viem parse/format round trips", () => {
    for (const value of ["0", "0.5", "5", "5.25", "120.123456", "999999.000001"]) {
      expect(amountToUnits(value)).toBe(parseUnits(value, USDC_DECIMALS));
      expect(unitsToAmount(parseUnits(value, USDC_DECIMALS))).toBe(
        formatUnits(parseUnits(value, USDC_DECIMALS), USDC_DECIMALS),
      );
    }
  });

  it("converts units to trimmed decimal strings", () => {
    expect(unitsToAmount(12500000n)).toBe("12.5");
    expect(unitsToAmount(0n)).toBe("0");
    expect(unitsToAmount(1n)).toBe("0.000001");
  });
});
