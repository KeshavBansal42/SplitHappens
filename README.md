# SplitHappens

Split shared expenses with friends — no seed phrases, no bank transfers, no
"I'll pay you back next week". Log in with email, create a split, and each
person pays their share in USDC from a Privy embedded wallet. Funds sit in
an on-chain escrow on Arc and auto-release to the payee **only once every
share is collected**.

Built for [ETHGlobal Online 2026](https://ethglobal.com/) across the Privy
(*Best Financial Flow*) and Arc (*Best DeFi/Onchain Finance*) tracks.

## How it works

1. **Log in with email** — Privy creates an embedded wallet for you. No seed
   phrase is ever shown.
2. **Create a split** — name it, set the total, pick the payee wallet and
   how many people are splitting (including you). Everyone pays an equal
   share, and the backend registers the split on-chain (`openSplit`) so a
   real escrow exists before anyone pays.
3. **Share the link** — invite friends by email; each person claims their
   seat with an equal share.
4. **Pay your share** — one click approves the escrow and deposits your
   USDC on Arc testnet.
5. **Auto-release** — the contract holds the funds until the target is met,
   then anyone can trigger `release()` and the full balance goes to the
   payee. No one holds the money in between; the escrow is the source of
   truth.

## Why it's built this way

| Problem | Approach |
|---|---|
| Seed phrases scare off non-crypto users | Privy embedded wallets — email login, wallet in the background |
| Group payments need trust | Escrow releases only when fully funded (conditional, multi-step settlement) |
| Paying someone back is manual | USDC on Arc testnet — cheap, fast, settled on-chain |
| Verified humans only (stretch) | Optional Selfie Check gate via World |

### How Privy is used

- **Client (`apps/web`)** — `@privy-io/react-auth`: email login, embedded
  wallet creation, and signing the USDC approve + deposit transactions.
- **Server (`apps/api`)** — `@privy-io/server-auth`: verifies every request's
  Privy JWT and maps the verified identity to a local user row.

### How Arc / USDC is used

- All settlement is **USDC on Arc testnet** (chain id `5042002`), where USDC
  is also the gas asset.
- The escrow contract (`SplitEscrow`) holds USDC per split, records each
  participant's contribution, and pays the payee the full balance once
  `collected >= target` — a genuine conditional settlement flow, not a plain
  transfer.
- Amounts are handled as decimal strings in the database and 6-decimal raw
  units on-chain — no float math around money.

### How World Selfie Check is used (stretch)

Splits can opt into verified-participants-only mode. The backend carries the
`verifiedHuman` / `requireVerification` fields and a `POST /verify`
endpoint, ready for a World Sandbox Selfie Check gate in the client.

## Architecture

```
               ┌───────────────────┐
               │   Privy (auth +   │
               │  embedded wallet) │
               └─────────┬─────────┘
                         │
                         ▼
┌──────────────────────────────────────────┐
│               Frontend (apps/web)         │
│  - Privy login + wallet                  │
│  - Create split / join / Pay my share    │
│  - Status dashboard (polls /status)      │
└────────────────────┬─────────────────────┘
                     │  REST API
                     ▼
┌──────────────────────────────────────────┐
│            Backend (apps/api)             │
│  - Split CRUD + pay intent endpoints      │
│  - Registers splits on-chain (openSplit)  │
│  - Confirms deposits from tx receipts     │
│  - Auto-releases when fully funded        │
└────────────────────┬─────────────────────┘
                     │  viem calls / calldata
                     ▼
            ┌────────────────────┐
            │  SplitEscrow (Arc)  │
            │  USDC + release     │
            └────────────────────┘
```

## Repository layout

```
apps/api         Express API, Postgres schema, chain watchers
apps/web         React app — Privy login, wallet, pay flow
packages/shared  API contract types shared by web and api
contracts/       SplitEscrow contract, deploy script, hardhat tasks, tests
```

## Stack

- **Wallet / auth:** Privy (`@privy-io/react-auth`, `@privy-io/server-auth`)
- **Chain:** Arc testnet via viem; USDC settlement
- **Escrow:** Solidity `SplitEscrow` contract (Hardhat)
- **API:** Node + Express + Prisma (Postgres)
- **Web:** React + Vite + TypeScript
