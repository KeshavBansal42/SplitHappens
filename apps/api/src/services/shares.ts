import { amountToUnits, unitsToAmount } from "../chain/units.js";

export function computeShares(totalUnits: bigint, count: number): bigint[] {
  const base = totalUnits / BigInt(count);
  const remainder = totalUnits % BigInt(count);

  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? base + remainder : base,
  );
}

export function sharesAsAmounts(totalAmount: string, count: number): string[] {
  return computeShares(amountToUnits(totalAmount), count).map((units) =>
    unitsToAmount(units),
  );
}
