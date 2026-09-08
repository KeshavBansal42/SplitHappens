# `/api/v1/splits/:id/pay` — handshake reference

Confirmed against the **live API** on 2026-09-04 (dev auth mode, local
Postgres). This is the shape the wallet/UI integration codes against. The
canonical zod schemas live in
[`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) —
trust those over any hand-written example here.

---

## Endpoint

```
POST /api/v1/splits/:id/pay
```

### Auth

| Mode | Header |
|---|---|
| Production | `Authorization: Bearer <privy-jwt>` |
| Dev (`AUTH_MODE=dev`) | `x-dev-user-id: <id>` (+ optional `x-dev-wallet: <0x…>` on the first request) |

Both modes run the exact same handler — only the identity source differs.

### Request body

```jsonc
{
  "txHash": "0x…",      // the wallet's real deposit transaction hash (64 hex)
  "amount": "40.00"     // decimal string, up to 6 dp — MUST equal the caller's share
}
```

### Success — `200 OK`

Returns the caller's **participant row** (already joined via
`POST /splits/:id/join`):

```jsonc
{
  "id": "cmtndytmx0003etknijkjczfq",          // participant id (cuid)
  "userId": "cmtndytm70000etkn6sd948i0",      // app user id
  "walletAddress": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "shareAmount": "40",                        // decimal string (trailing zeros trimmed)
  "paid": false,                              // false until the confirm watcher verifies on-chain
  "txHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "confirmedAt": null
}
```

`paid` flips to `true` and `confirmedAt` is set **only after** the backend's
confirmation watcher verifies the deposit on-chain (receipt success, sent to
the escrow, correct split id + amount). Until then the payment is *pending*.

---

## Errors

All errors share one envelope: `{ "error": { "code", "message" }, "details"? }`.

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing/invalid auth |
| 403 | `FORBIDDEN` | Caller never joined this split — `"You must join the split before paying"` |
| 403 | `FORBIDDEN` | Split has `requireVerification` and caller is not a verified human (stretch gate) |
| 404 | `NOT_FOUND` | Split id does not exist |
| 409 | `CONFLICT` | Split already released |
| 409 | `ALREADY_PAID` | Caller's share is already marked paid |
| 409 | `PAYMENT_PENDING` | A payment is recorded but not yet confirmed — retry after it confirms or clears |
| 422 | `AMOUNT_MISMATCH` | `amount` does not exactly equal the caller's share |
| 422 | `VALIDATION_ERROR` | Malformed body (bad `txHash`, non-string amount, …) — details list each field |

> Order of checks (so you can predict which error wins): split exists →
> not released → caller is a participant → verification gate → not already
> paid → no pending tx → amount matches share.

---

## Lifecycle after `/pay` (what to poll)

1. `POST /splits/:id/pay` → `200`, participant `paid: false`, `confirmedAt: null`
2. Backend confirm watcher verifies the on-chain deposit →
   `GET /splits/:id` shows `paid: true`, `confirmedAt` set
3. When all participants are confirmed and the escrow is fully funded, the
   release watcher calls `release()` →
   `GET /splits/:id/status` shows `split.status: "released"` and
   `onChain.released: true`

The dashboard should poll `GET /splits/:id/status` for steps 2–3.

---

## Live capture (verbatim, 2026-09-04)

Environment: `AUTH_MODE=dev`, `http://localhost:4000`. All ids are real
responses from the running API.

### Happy path

```bash
# create split (alice is the payee)
curl -X POST http://localhost:4000/api/v1/splits \
  -H 'content-type: application/json' \
  -H 'x-dev-user-id: alice' -H 'x-dev-wallet: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
  -d '{"title":"Integration Dinner","totalAmount":"120.00","payeeAddress":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
```
```jsonc
// 201
{ "id": "1", "title": "Integration Dinner", "totalAmount": "120",
  "payeeAddress": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "requireVerification": false, "status": "pending",
  "createdAt": "2026-09-04T20:07:59.604Z" }
```

```bash
# alice joins with a 40.00 share
curl -X POST http://localhost:4000/api/v1/splits/1/join \
  -H 'content-type: application/json' -H 'x-dev-user-id: alice' \
  -d '{"shareAmount":"40.00"}'
```
```jsonc
// 201
{ "splitId": "1", "userId": "cmtndytm70000etkn6sd948i0", "shareAmount": "40.00" }
```

```bash
# alice reports her deposit
curl -X POST http://localhost:4000/api/v1/splits/1/pay \
  -H 'content-type: application/json' -H 'x-dev-user-id: alice' \
  -d '{"txHash":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","amount":"40.00"}'
```
```jsonc
// 200
{ "id": "cmtndytmx0003etknijkjczfq", "userId": "cmtndytm70000etkn6sd948i0",
  "walletAddress": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "shareAmount": "40",
  "paid": false, "txHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "confirmedAt": null }
```

### Error probes

```jsonc
// amount ≠ share
// 422 AMOUNT_MISMATCH
{ "error": { "code": "AMOUNT_MISMATCH",
    "message": "Amount does not match your share for this split" } }

// a second pay while the first is still pending
// 409 PAYMENT_PENDING
{ "error": { "code": "PAYMENT_PENDING",
    "message": "A payment for this split is still awaiting confirmation" } }

// a user who never joined tries to pay
// 403 FORBIDDEN
{ "error": { "code": "FORBIDDEN",
    "message": "You must join the split before paying" } }

// no auth header (dev mode)
// 401 UNAUTHORIZED
{ "error": { "code": "UNAUTHORIZED",
    "message": "Missing x-dev-user-id header (AUTH_MODE=dev)" } }

// malformed txHash
// 422 VALIDATION_ERROR
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body" },
  "details": [{ "path": "txHash", "message": "must be a 0x transaction hash" }] }

// unknown split
// 404 NOT_FOUND
{ "error": { "code": "NOT_FOUND", "message": "Split 999 not found" } }

// paying a released split
// 409 CONFLICT
{ "error": { "code": "CONFLICT", "message": "Split is already released" } }
```

### Post-confirmation state (after the confirm watcher marks the deposit)

```bash
curl http://localhost:4000/api/v1/splits/1 -H 'x-dev-user-id: alice'
```
```jsonc
// 200 — participant section
{ "id": "cmtndytmx0003etknijkjczfq", "userId": "cmtndytm70000etkn6sd948i0",
  "walletAddress": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "shareAmount": "40",
  "paid": true, "txHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "confirmedAt": "2026-09-05T01:38:32.114Z" }
```

---

## Integration notes

- **Call order:** the wallet must send the escrow `deposit()` transaction
  **first**, then `POST /pay` with that transaction's real hash. The hash is
  verified on-chain afterward — a fabricated hash will be cleared and the
  user can retry.
- **Amount:** must be the participant's exact `shareAmount` (6-dp decimal
  string). Sending a different value is a 422 — do not round or reformat.
- **Idempotency:** a duplicate `/pay` while the first is unconfirmed returns
  `PAYMENT_PENDING` (409). After confirmation, further `/pay` calls return
  `ALREADY_PAID` (409). Treat 409 as "already handled", not an error.
