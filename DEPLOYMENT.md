# KAMZYBOT'S MEDIA — Deployment & Setup

This app is a **TanStack Start** project (React 19 + Vite 7) backed by **Lovable Cloud (Supabase)**. The recommended hosting is **Lovable's built-in publish flow** (one-click, no config). The project is also configured to deploy on Vercel/Cloudflare with a small amount of setup.

---

## 1. Environment Variables

| Variable                        | Where           | Purpose                                                    |
| ------------------------------- | --------------- | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | client + server | Lovable Cloud URL (auto-provided)                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client + server | Anon/publishable key (auto-provided)                       |
| `SUPABASE_URL`                  | server only     | Same as above for server functions                         |
| `SUPABASE_PUBLISHABLE_KEY`      | server only     | Same                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only     | Admin key — used by webhook handlers & credential delivery |
| `NEURAPAY_SECRET_KEY`           | server only     | NeuraPay secret key for transaction initialization & verification |
| `NEURAPAY_BASE_URL`             | server only     | NeuraPay API base URL (default: https://neurapay.com.ng/api/v1) |
| `NEURAPAY_PUBLIC_KEY`           | client + server | NeuraPay public key for wallet deposit initialization      |
| `NEURAPAY_WEBHOOK_SECRET`       | server only     | NeuraPay webhook signature secret                          |
| `LOVABLE_API_KEY`               | server only     | Lovable AI Gateway (already configured)                    |

> Inside Lovable, these are managed under **Cloud → Secrets**. Do **not** commit them to git.

---

## 2. Database

The Supabase database is provisioned automatically by Lovable Cloud. Tables created by migrations in `supabase/migrations/`:

- `profiles`, `user_roles`, `wallets`, `wallet_transactions`
- `products`, `product_categories`, `product_credentials` _(login logs delivered to buyers)_
- `orders`, `order_items`, `payment_intents`
- `site_settings`, `activity_logs`

RLS is enabled on every table. The first signup using `kamzybotsmedia@gmail.com` is auto-promoted to admin via the `handle_new_user` trigger.

### Product Logs (credentials)

- Admin → `/admin` → **Products** tab → key icon to bulk-import logs (one per line, e.g. `email:password`).
- On purchase, `purchase_with_wallet` deducts wallet balance & creates an order; then a TanStack server function calls `assign_credential_to_order`, which atomically locks one unassigned credential to that order. The same log can never be assigned twice (`FOR UPDATE SKIP LOCKED`).
- Users view their delivered logs in **Dashboard → My Orders → Credentials**.

---

## 3. Deploying

### 3a. Lovable (recommended)

Just click **Publish** in the Lovable editor. Live at `https://kamzybots-media.lovable.app` (custom domains available in Project Settings).

### 3b. Vercel

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. **Framework preset:** Other.
4. **Build command:** `npm run build`
5. **Output directory:** `.output/public` (TanStack Start / Nitro output).
6. Add all env vars from section 1 in Vercel → Project → Settings → Environment Variables.
7. After deploy, set the Supabase **Site URL** & **Redirect URLs** (Cloud → Auth) to your Vercel domain so Google OAuth callbacks work.

> `vercel.json` in the repo is for static-export overrides only; the Nitro Vercel preset handles routing automatically.

### 3c. Cloudflare Pages / Workers

The default Nitro target in `vite.config.ts` is `cloudflare`. `npm run build` produces a Worker bundle in `.output/`. Deploy with `wrangler deploy` or the Cloudflare Pages GitHub integration.

### 3d. Netlify

Set build command `npm run build`, publish directory `.output/public`, then add env vars from section 1. Nitro's Netlify preset handles function routing.

---

## 4. Payments

- **NeuraPay:** initialize wallet funding via `/api/payment/init-neurapay`, verify via `/api/payment/verify-neurapay`, and configure webhook notifications at `/api/webhooks/neurapay`.

---

## 5. OAuth

Google OAuth is wired via the Lovable broker (`src/integrations/lovable`). After deploying to a custom domain, add the new origin to:

- Lovable Cloud → Auth → Site URL + Redirect URLs
- Google Cloud Console → OAuth client → Authorized redirect URIs
