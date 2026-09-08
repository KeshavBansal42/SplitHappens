/**
 * USDC amount helpers.
 *
 * USDC has 6 decimals. The database stores token units as Decimal(36,6)
 * strings; the chain works in raw bigint units (wei-scale, 6 dp). These
 * helpers are the only place that converts between the two, so JSON never
 * carries floats.
 */

import { formatUnits, parseUnits } from "viem";
import { Prisma } from "@prisma/client";

export const USDC_DECIMALS = 6;

/** "12.5" | "120.00" -> 12500000n (raw USDC units). */
export function amountToUnits(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/** 12500000n -> "12.5" (plain decimal string, no trailing zeros). */
export function unitsToAmount(units: bigint): string {
  return formatUnits(units, USDC_DECIMALS);
}

/** DB Decimal -> plain string (Prisma returns Decimal objects). */
export function decimalToAmount(value: Prisma.Decimal | string): string {
  return value instanceof Prisma.Decimal ? value.toFixed() : value;
}

/** DB Decimal -> raw bigint units. */
export function decimalToUnits(value: Prisma.Decimal): bigint {
  return parseUnits(value.toFixed(), USDC_DECIMALS);
}
