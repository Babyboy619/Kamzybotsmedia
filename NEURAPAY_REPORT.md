# KAMZYBOT'S MEDIA — NeuraPay Audit & Repair Report

## 1. Architecture (preserved as-is)

| Layer | Technology | Status |
| --- | --- | --- |
| Frontend | Vite + React SPA (`src/`) | Unchanged |
| Backend | Cloudflare Pages Functions (`functions/api/**`) | Repaired |
| Local dev API | Express (`server/api.ts`) | Unchanged |
| Database / Auth | Supabase (external project) | Unchanged + 1 migration |
| Hosting / CI | GitHub → Cloudflare Pages | Unchanged |
| Production domain | `https://kamzybotsmedia.store` | Unchanged |

No framework, router, hosting target, or database was swapped.

## 2. Root cause of "Request failed" and 502 Bad Gateway

Probing the live API confirmed the failure:

```
POST https://neurapay.com.ng/api/v1/transactions/init    → 405 Method Not Allowed (Allow: GET, HEAD)
GET  https://neurapay.com.ng/api/v1/transactions/init    → 401 Unauthorized (i.e. endpoint exists, needs auth)
```

Three compounding defects:

1. **Wrong HTTP method.** The functions issued `POST` to `transactions/init` and
   `transactions/verify`. NeuraPay only serves `GET`/`HEAD` there, so every call
   returned **405**.
2. **Unhandled upstream failure.** The 405 HTML body was parsed as JSON, the
   parse threw, the exception escaped the handler, and Cloudflare turned the
   crashed Worker into a **502 Bad Gateway** — which the frontend surfaced as the
   generic *"Request failed"*.
3. **No error boundary.** Any NeuraPay outage or DNS blip produced the same 502
   instead of a readable message.

## 3. Payment gateways

Audited the whole tree for Monnify, OPay, Paystack, Flutterwave and Squad:
**no gateway code, keys, SDKs, or env references exist.** NeuraPay is already
the only integrated gateway, and the wallet page exposes exactly one funding
control — **Fund Wallet with NeuraPay**. (The admin-side manual bank-transfer
approval queue is not a gateway and was left intact.)

## 4. What was rebuilt

### `functions/api/_neurapay.js` (new shared module)
- Single source of truth for base URL `https://neurapay.com.ng/api/v1`.
- `GET` by default, `POST` selectable via `NEURAPAY_HTTP_METHOD` if NeuraPay
  changes — no code edit needed.
- Tolerant response parsing (never throws on HTML/empty bodies) → **no more 502s**.
- Supabase bearer-token auth resolution and service-role REST helpers.
- HMAC-SHA256 webhook signature verification (constant-time compare).
- `creditWalletOnce()` — atomic, idempotent crediting.

### `functions/api/payment/init-neurapay.js`
Validates amount (₦100–₦1,000,000) and reference format, records a `pending`
intent in Supabase **before** contacting NeuraPay, then returns the payment URL
/ account details. No credit ever happens at init.

### `functions/api/payment/verify-neurapay.js`
Scoped to the authenticated user's own intent, re-verifies against NeuraPay,
and checks **both amount and currency (NGN)** before crediting.

### `functions/api/webhooks/neurapay.js`
Rejects unsigned and badly-signed payloads with 401, then **re-verifies the
transaction with NeuraPay directly** before crediting — the webhook body is
never trusted as proof of payment.

## 5. Atomic, idempotent crediting (server-side only)

The client can never credit a wallet. Crediting is gated by three independent
locks:

1. A conditional `PATCH ... ?reference=eq.X&status=neq.success` claims the
   intent — only the first concurrent caller gets a row back.
2. `credit_wallet()` short-circuits on a duplicate `wallet_transactions.reference`.
3. A new **unique index** on `wallet_transactions.reference` makes a double
   credit impossible at the database level.

Result: verify-twice, webhook-twice, and verify+webhook-simultaneously all
credit exactly once.

## 6. Database migration

Run `migrations/20260813000000_neurapay_provider_reference.sql` in the Supabase
SQL editor. It adds `payment_intents.provider_reference`, the reference lookup
indexes, and the unique idempotency index.

## 7. Required environment variables (Cloudflare Pages)

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEURAPAY_SECRET_KEY` | Server (secret) | NeuraPay API authentication |
| `NEURAPAY_WEBHOOK_SECRET` | Server (secret) | HMAC webhook validation |
| `NEURAPAY_HTTP_METHOD` | Server (optional) | `GET` (default) or `POST` |
| `SUPABASE_URL` | Server | Supabase REST base |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (secret) | Privileged wallet writes |
| `VITE_SUPABASE_URL` | Build | Browser client |
| `VITE_SUPABASE_ANON_KEY` | Build | Browser client |

Webhook URL to register in the NeuraPay dashboard:
`https://kamzybotsmedia.store/api/webhooks/neurapay`

## 8. Verification performed

15 end-to-end handler tests against mocked NeuraPay and Supabase — **all passing**:

- unauthorized init rejected (401)
- amount below/above limits rejected (400)
- malformed reference rejected (400)
- successful init creates a pending intent and credits nothing
- verify credits the wallet exactly once
- duplicate verify returns `alreadyCredited`, credits nothing
- unknown reference → 404
- failed payment is never credited
- NeuraPay outage returns readable JSON, **not a 502**
- webhook without signature → 401
- webhook with bad signature → 401
- webhook credits once
- duplicate webhook credits nothing
- cancelled event acknowledged without crediting

Typecheck and lint are clean; the app builds and renders.

## 9. Deployment

Push to the connected GitHub branch — Cloudflare Pages builds and deploys
automatically. Before the first payment: apply the migration (§6), set the
environment variables (§7), and register the webhook URL.
