# Escrow contract interface — handoff spec

This directory is the frozen contract interface agreed between Person A
(smart contract) and Person B (backend) on Day 1. Person B's code depends
only on the function signatures below — never on a deployed artifact.

The canonical Solidity source, tests, and deployment live in Person A's
repo/tooling; this spec exists so the backend can be built and verified
against a mock before the real testnet deployment lands.

## Escrow (Arc testnet, USDC)

All amounts are in **USDC token units (6 decimals)**.

- `openSplit(uint256 splitId, address payee, uint256 target)` — registers a
  new split on-chain. Must be called before any deposit can be accepted.
  This is Person A's responsibility; no equivalent exists on the backend side yet.
- `deposit(uint256 splitId, uint256 amount)` — `nonpayable`; `amount` is in
  USDC token units (6 decimals). Caller must call
  `USDC.approve(escrowAddress, amount)` **before** calling this.
- `release(uint256 splitId)` — permissionless; sends the escrow's full
  USDC balance for that split to the payee once `collected >= target`.
  Reverts when already released.
- `getSplitStatus(uint256 splitId) view returns (uint256 collected, uint256 target, bool released)`

There are no events in the frozen interface: the backend confirms deposits
by decoding calldata from transaction receipts and polls `getSplitStatus`
to decide when to release.

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
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "splitId", type: "uint256" },
      { name: "amount",  type: "uint256" },
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
      { name: "target",    type: "uint256" },
      { name: "released",  type: "bool"    },
    ],
  },
] as const;
```

## Deployed artifacts

| Artifact | Value | Owner |
|---|---|---|
| Escrow address (Arc testnet) | _set by Person A after deploy_ | Person A |
| USDC address (Arc testnet) | `0x3600000000000000000000000000000000000000` | Arc protocol |

## Open gap — `openSplit` handshake

The backend does not yet call `openSplit`. Until Person B adds that call
(or an equivalent off-chain mechanism), no deposit will be accepted by the
contract. **Person B needs to call `openSplit(splitId, payeeAddress, targetAmount)`
on split creation** — or coordinate with Person A to do it from the admin wallet.
