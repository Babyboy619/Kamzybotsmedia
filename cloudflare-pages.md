# Cloudflare Pages Deployment (SSR via Functions)

This project is a **TanStack Start** app. It already builds a Cloudflare-compatible
Worker bundle through `@cloudflare/vite-plugin` + nitro (configured by
`@lovable.dev/vite-tanstack-config`). You can deploy it to Cloudflare Pages with
Functions — **server functions, webhooks, and NeuraPay verification keep working**.
This is NOT a static SPA deployment.

> If you want a pure static SPA on Cloudflare Pages, you would need to migrate
> off TanStack Start to plain Vite + React Router. That migration is intentionally
> not done here.

---

## 1. Build settings (Cloudflare dashboard)

When you create the Pages project, set:

| Field            | Value           |
| ---------------- | --------------- |
| Framework preset | **None**        |
| Build command    | `npm run build` |
| Build output dir | `dist`          |
| Root directory   | (leave blank)   |
| Node.js version  | `20`            |

The TanStack build produces a Cloudflare-compatible Worker into `dist/` plus
static assets. The `_worker.js` is loaded automatically by Cloudflare Pages.

> **Do NOT** add `public/_redirects` with `/* /index.html 200`. That rule
> would short-circuit the SSR Worker and break every server function, the
> auth flow, payment verification, and credential delivery. The TanStack
> Worker handles routing itself.

---

## 2. Required environment variables

In **Pages project → Settings → Environment variables**, add to both
**Production** and **Preview**:

### Client-visible (Vite — bundled into the browser build)

```
VITE_SUPABASE_URL=https://jerhefcpsmcvxkmvyyqe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your supabase publishable key>
VITE_SUPABASE_PROJECT_ID=jerhefcpsmcvxkmvyyqe
VITE_SITE_URL=https://yourdomain.com        # used for payment redirects
NEURAPAY_PUBLIC_KEY=<your neurapay public key>      # client and server use this for transaction lookup
```

### Server-only (must NEVER be exposed to the browser)

```
SUPABASE_URL=https://jerhefcpsmcvxkmvyyqe.supabase.co
SUPABASE_PUBLISHABLE_KEY=<same publishable key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>   # SECRET
NEURAPAY_SECRET_KEY=<your neurapay secret key>      # SECRET
NEURAPAY_BASE_URL=https://neurapay.com.ng/api/v1
NEURAPAY_WEBHOOK_SECRET=<your neurapay webhook secret> # SECRET
```

Mark the secret keys as **Encrypted** in the Cloudflare UI.

---

## 3. NeuraPay webhook / redirect URLs

After your first deploy you get a URL like
`https://<project>.pages.dev` (or your custom domain).

- **NeuraPay webhook URL**: configure NeuraPay to send notifications to
  `https://<your-domain>/api/webhooks/neurapay`.

If you later add webhook-driven crediting for another provider, expose it under
`/api/public/<name>` (the `/api/public/*` prefix bypasses auth for external
callers — always verify signatures inside the handler).

---

## 4. Connecting via Git

1. Push the repo to GitHub.
2. Cloudflare Pages → **Create project → Connect to Git** → pick the repo.
3. Apply the build settings from §1 and the env vars from §2.
4. Every push to `main` deploys to Production. Other branches deploy to Preview.

---

## 5. Connecting via Wrangler (alternative)

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=kamzybots-media
```

Set the same env vars with `wrangler pages secret put NAME --project-name=kamzybots-media`.

---

## 6. Custom domain

Pages → your project → **Custom domains → Set up a custom domain**. Cloudflare
will issue the certificate automatically. Update `VITE_SITE_URL` to match and
redeploy so payment redirect URLs use the new domain.

---

## 7. Smoke-test checklist after deploy

- [ ] Home page loads and SSR HTML returns a `200`
- [ ] `/auth` register + login works
- [ ] `/dashboard` shows wallet balance, orders, profile
- [ ] `/wallet` → NeuraPay deposit flow credits wallet end-to-end
- [ ] `/admin` accessible by the admin email; product image upload works
- [ ] A purchase auto-delivers a credential from the product log pool
- [ ] Footer shows only Facebook + TikTok links
- [ ] Mobile (360px) layout still works on every page

If any page returns 500, check the **Cloudflare → Pages → Functions → Logs**
for the captured error stack.
