# Escrow contract interface

The contract interface the backend builds against. The full Solidity
source lives with the contract lead; this spec is what the api depends
on and is frozen for the week.

## Escrow (Arc testnet, USDC)

- `deposit(uint256 splitId, uint256 amount)` — amount is in USDC token
  units (6 decimals). Caller must approve the escrow first.
- `release(uint256 splitId)` — permissionless; sends the full USDC
  balance for that split to the payee once collected >= target.
- `getSplitStatus(uint256 splitId) view returns (uint256 collected, uint256 target, bool released)`

There are no events in the frozen interface: the backend confirms
deposits by decoding calldata from receipts and polls getSplitStatus
to decide when to release.

## ABI fragment consumed by the api

```ts
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
```

## Deployed artifacts

| Artifact | Value | Owner |
|---|---|---|
| Escrow address (Arc testnet) | set by contract lead | contract lead |
| Testnet USDC address (Arc) | set in api .env from Arc docs | contract lead |
