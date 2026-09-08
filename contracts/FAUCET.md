# Getting testnet USDC on Arc

Arc testnet uses USDC as its native currency — it pays for gas *and* it's
the thing being split, so everyone touching the chain (deploying, paying
into a split, running the backend's release call) needs some in their
wallet.

## Steps

1. Get a wallet address for each role that needs one:
   - Person A: one deployer/test address (used in `.env` for this repo)
   - Person C: whatever address Privy's embedded wallet creates per test user
   - A couple of throwaway addresses for "participant" testing
2. Go to **faucet.circle.com**
3. Select **Arc Testnet** from the network dropdown
4. Paste the wallet address, request USDC
5. Confirm it landed by checking the address on the block explorer:
   **testnet.arcscan.app**

## For the team

- Grab extra testnet USDC for 3–4 throwaway addresses early on Day 1–2, so
  nobody is blocked waiting on the faucet mid-integration.
- The faucet is rate-limited per address/IP — if it stops working, wait a
  bit and retry, don't panic-refresh.
- Everything above is testnet-only. Testnet USDC has no real value and
  can't be moved to mainnet.

## Network details (for adding Arc to a wallet manually)

| Field | Value |
|---|---|
| Network name | Arc Testnet |
| RPC URL | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Currency symbol | USDC |
| Block explorer | https://testnet.arcscan.app |
