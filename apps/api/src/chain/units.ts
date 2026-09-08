import { formatUnits, parseUnits } from "viem";
import { Prisma } from "@prisma/client";

export const USDC_DECIMALS = 6;

export function amountToUnits(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

export function unitsToAmount(units: bigint): string {
  return formatUnits(units, USDC_DECIMALS);
}

export function decimalToAmount(value: Prisma.Decimal | string): string {
  return value instanceof Prisma.Decimal ? value.toFixed() : value;
}

export function decimalToUnits(value: Prisma.Decimal): bigint {
  return parseUnits(value.toFixed(), USDC_DECIMALS);
}
