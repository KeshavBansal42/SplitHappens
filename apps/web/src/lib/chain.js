import { createPublicClient, defineChain, http } from "viem";
import { ARC_RPC_URL, ESCROW_ADDRESS, USDC_ADDRESS } from "./env.js";

export const USDC_DECIMALS = 6;

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  // USDC is the gas token here. Native balances are 18-decimal wei even
  // though the ERC-20 interface reports 6 decimals.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
});

export function getPublicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC_URL) });
}

export function usdcAddress() {
  return USDC_ADDRESS;
}

/** True when the escrow already has this split id registered on-chain. */
export async function escrowSplitExists(splitId) {
  if (!ESCROW_ADDRESS) return false;
  try {
    await getPublicClient().readContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "getSplitStatus",
      args: [BigInt(splitId)],
    });
    return true;
  } catch {
    return false;
  }
}

export const escrowAbi = [
  {
    type: "function",
    name: "openSplit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "splitId", type: "uint256" },
      { name: "payeeAddress", type: "address" },
      { name: "target", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "splitId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "splitId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getSplitStatus",
    stateMutability: "view",
    inputs: [{ name: "splitId", type: "uint256" }],
    outputs: [
      { name: "collected", type: "uint256" },
      { name: "target", type: "uint256" },
      { name: "released", type: "bool" },
    ],
  },
];

export const usdcAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export function amountToUnits(amount) {
  const [whole = "0", fraction = ""] = String(amount).split(".");
  const padded = (fraction + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || "0");
}

export function unitsToAmount(units) {
  const whole = units / 10n ** BigInt(USDC_DECIMALS);
  const fraction = (units % 10n ** BigInt(USDC_DECIMALS))
    .toString()
    .padStart(USDC_DECIMALS, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""}`;
}

export const CHAIN_ID = 5042002;
