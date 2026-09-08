/**
 * Frozen escrow ABI fragment (see contracts/README.md).
 *
 * The full contract is owned by the contract lead; the backend only knows
 * these three functions. If the deployed ABI changes, this file is the
 * single place the API needs to be updated.
 */

export const escrowAbi = [
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
] as const;

export type EscrowStatus = {
  collected: bigint;
  target: bigint;
  released: boolean;
};
