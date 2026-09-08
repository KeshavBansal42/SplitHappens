# SplitHappens

A group-payments app with **no seed phrases**: log in with email (Privy
embedded wallet), create a shared expense, each person pays their share in
USDC on the **Arc testnet**, and the escrow contract auto-releases to the
payee **only once every share is collected**.

Built for [ETHGlobal Online 2026](https://ethglobal.com/) — submitted to the
Privy (*Best Financial Flow*) and Arc (*Best DeFi/Onchain Finance*) tracks,
with a World (*Selfie Check*) stretch.

> **Status:** the backend (`apps/api`) is implemented against the frozen
> Day 1 interface. The escrow contract address and testnet USDC address are
> environment configuration supplied by the contract lead.

---

## Why this works for the tracks

| Track | How SplitHappens satisfies it |
|---|---|
| Privy — financial flow | Privy is the only auth + wallet layer. A wallet is auto-created at signup and users pay with it directly |
| Arc — DeFi/onchain finance | All settlement is USDC on Arc testnet. The escrow is a **conditional** flow — funds release only when the full target is collected, not a plain transfer |
| World — Selfie Check (stretch) | Splits can require verified participants; the Pay button only unlocks after a Selfie Check (isolated, feature-flagged) |

## How Privy is used

- **Client (frontend app, `apps/web`):** `@privy-io/react-auth` — email
  login and the embedded wallet that signs the USDC deposit. No seed phrase
  is ever shown to the user.
- **Server (`apps/api`):** `@privy-io/server-auth` verifies the Privy JWT on
  every request (`AUTH_MODE=privy`). The verified `userId` maps to a local
  user row; the wallet address that paid is cross-checked against the
  transaction receipt on-chain.
- During development, `AUTH_MODE=dev` lets the API run without Privy
  credentials by trusting `x-dev-user-id` / `x-dev-wallet` headers — the
  same request shape, for local testing only.

## How Arc / USDC is used

- **Network:** Arc testnet — chain id `5042002`, RPC
  `https://rpc.testnet.arc.network`. Gas is paid in USDC.
- **Money:** every share is a USDC amount. The DB stores token units as
  `Decimal(36,6)` strings; the chain uses 6-decimal raw units. Floats never
  touch money.
- **Escrow:** participants approve the escrow contract and call
  `deposit(splitId, amount)`. The backend confirms deposits by decoding the
  on-chain calldata from transaction receipts, then watches
  `getSplitStatus` — when `collected >= target`, anyone can call
  `release(splitId)` and the full balance goes to the payee. The contract is
  the source of truth; the database is a cache for the UI.
- The contract interface is frozen in [`contracts/README.md`](contracts/README.md).

## Architecture

```
               ┌───────────────────┐
               │   Privy (auth +   │
               │  embedded wallet) │
               └─────────┬─────────┘
                         │
                         ▼
┌──────────────────────────────────────────┐        ┌──────────────────────┐
│               Frontend (apps/web)         │◄──────►│  World Selfie Check  │  STRETCH
│  - Privy login                            │        │  (feature-flagged)   │
│  - Create split / join / Pay my share     │        └──────────────────────┘
│  - Status dashboard (polls /status)       │
└────────────────────┬──────────────────────┘
                     │  REST API (frozen contract)
                     ▼
┌──────────────────────────────────────────┐
│            Backend (apps/api)             │
│  - Split CRUD + pay intent endpoints      │
│  - Deposit confirmation watcher (polling) │
│  - Release watcher (auto-release)         │
│  - Postgres via Prisma                    │
└────────────────────┬──────────────────────┘
                     │  viem calls / calldata
                     ▼
        ┌──────────────────────────┐
        │  Escrow contract (Arc)    │
        │  USDC deposits + release  │
        └──────────────────────────┘
```

## Repository layout

```
apps/api         Backend — Express API, prisma schema, chain watchers
apps/web         Frontend — React + Privy login, embedded wallet, pay flow
packages/shared  Frozen API contract: zod schemas + types shared by api/web
contracts/       SplitEscrow contract, deploy script, hardhat tasks + tests
docker-compose   Local Postgres 16
```

## Getting started

Prerequisites: Node 20+, pnpm (`corepack enable`), Postgres 16 (the
`docker-compose.yml` service, or any local instance), and a `.env` file.

```bash
# 1. install and start the database
pnpm install
docker compose up -d          # or point DATABASE_URL at your own postgres

# 2. configure environment
cp .env.example .env
#    fill in DATABASE_URL, and either AUTH_MODE=privy with Privy keys,
#    or AUTH_MODE=dev for header-based local auth.

# 3. migrate and run the api
pnpm --filter @splithappens/api db:migrate
pnpm --filter @splithappens/api db:generate
pnpm dev:api                  # http://localhost:4000

# 4. run the web app (separate terminal)
cp apps/web/.env.example apps/web/.env   # add your VITE_PRIVY_APP_ID
pnpm --filter @splithappens/web dev      # http://localhost:5173
```

The chain watchers need `USDC_ADDRESS`, `ESCROW_ADDRESS` (from the contract
deploy) and `RELEASER_PRIVATE_KEY` (a wallet holding a little testnet USDC
to pay gas). See `.env.example`.

## API

All routes live under `/api/v1` and (except `/health`) require
`Authorization: Bearer <privy-jwt>` — or `x-dev-user-id` when
`AUTH_MODE=dev`. Amounts are decimal strings; split ids are strings.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/api/v1/splits` | Create a split (title, totalAmount, payeeAddress) |
| `GET` | `/api/v1/splits/:id` | Split detail + participants (db view) |
| `POST` | `/api/v1/splits/:id/join` | Join with a shareAmount |
| `POST` | `/api/v1/splits/:id/pay` | Record the deposit txHash + amount |
| `GET` | `/api/v1/splits/:id/status` | Dashboard poll — db + on-chain state |

The `/pay` handshake (request shape, response, error codes, lifecycle) is
documented and captured live in
[`docs/api-pay-handshake.md`](docs/api-pay-handshake.md).

```bash
# dev-mode example
curl -X POST localhost:4000/api/v1/splits \
  -H 'content-type: application/json' \
  -H 'x-dev-user-id: alice' \
  -d '{"title":"Dinner","totalAmount":"120.00","payeeAddress":"0x..."}'

curl -X POST localhost:4000/api/v1/splits/1/join \
  -H 'content-type: application/json' -H 'x-dev-user-id: bob' \
  -d '{"shareAmount":"40.00"}'

curl -X POST localhost:4000/api/v1/splits/1/pay \
  -H 'content-type: application/json' -H 'x-dev-user-id: bob' \
  -d '{"txHash":"0x...","amount":"40.00"}'

curl localhost:4000/api/v1/splits/1/status -H 'x-dev-user-id: bob'
```

The canonical request/response shapes live in
[`packages/shared/src/index.ts`](packages/shared/src/index.ts).

## How the escrow release works

1. Everyone who wants to pay **joins** the split with their share.
2. Each participant approves the escrow contract and calls `deposit()` from
   their Privy wallet, then reports the tx via `POST /pay`.
3. The **confirmation watcher** polls receipts and marks a participant
   `paid` only when the tx was a successful `deposit(splitId, share)` into
   the escrow from that participant's wallet.
4. The **release watcher** polls `getSplitStatus`. Once
   `collected >= target` it sends `release()`, and the payee receives the
   whole balance. Anyone can also trigger release, so the backend can never
   get stuck holding funds.

## Testing

```bash
pnpm --filter @splithappens/api test               # unit + route tests (no db)
pnpm --filter @splithappens/api test:integration   # service tests against postgres
pnpm -r typecheck
```

## Stretch — World Selfie Check

The data model already carries `User.verifiedHuman` and
`Split.requireVerification` (both default `false`, inert until used). The
stretch flow is: mark a split `requireVerification: true` → participants
complete the World Sandbox Selfie Check → `POST /verify` sets
`verifiedHuman` → only then does their Pay button unlock. This stays out of
the core escrow path entirely.

## Notes for the demo / handoff

- The testnet USDC faucet is at <https://faucet.circle.com/> (Arc testnet)
  or <https://arc-faucet.dev/>; gas on Arc is USDC.
- Explorer: <https://testnet.arcscan.app>.
- The escrow contract and its deployment belong to the contract lead; see
  `contracts/README.md` for the interface this backend was built against.
