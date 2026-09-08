# Escrow contract interface — handoff spec

The frozen contract interface agreed between Person A (smart contract) and
Person B (backend). The Solidity source, tests, deployment, and CLI tasks
live in this directory; the API depends only on the signatures below.

## Escrow (Arc testnet, USDC)

All amounts are in **USDC token units (6 decimals)**.

- `openSplit(uint256 splitId, address payee, uint256 target)` — registers a
  new split on-chain. Must be called before any deposit can be accepted.
  The backend calls this from its releaser wallet when a split is created.
- `deposit(uint256 splitId, uint256 amount)` — `nonpayable`; `amount` is in
  USDC token units (6 decimals). Caller must call
  `USDC.approve(escrowAddress, amount)` **before** calling this.
- `release(uint256 splitId)` — permissionless; sends the escrow's full
  USDC balance for that split to the payee once `collected >= target`.
  Reverts when already released.
- `getSplitStatus(uint256 splitId) view returns (uint256 collected, uint256 target, bool released)`

The backend confirms deposits by decoding calldata from transaction
receipts and polls `getSplitStatus` to decide when to release.

## USDC on Arc testnet

| Item | Value |
|---|---|
| USDC system contract | `0x3600000000000000000000000000000000000000` |
| Decimals | 6 |
| Chain ID | 5042002 |

Faucet: see `FAUCET.md`.

## ABI fragment consumed by the API (`apps/api/src/chain/escrowAbi.ts`)

```ts
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
] as const;
```

## Deployed artifacts

| Artifact | Value | Owner |
|---|---|---|
| Escrow address (Arc testnet) | `0xf77bbF1907150F2a633A0748A14Fb3Bb29f7f961` | contract lead |
| USDC address (Arc testnet) | `0x3600000000000000000000000000000000000000` | Arc protocol |

## openSplit handshake

The backend calls `openSplit(splitId, payeeAddress, targetAmount)` from its
releaser wallet whenever a split is created (`apps/api/src/chain/escrow.ts`),
so every DB split has a registered on-chain escrow before any deposit is
accepted. If that call fails the split row is rolled back.
