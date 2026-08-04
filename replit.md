# KAMZYBOT'S MEDIA Logs

A digital goods storefront built with React 19 + Vite (frontend) and Express.js (backend API), using Supabase for authentication and database.

## Architecture

- **Frontend**: React 19, Vite 7, TypeScript, Tailwind CSS 4, Radix UI
- **Backend**: Express.js (TypeScript via tsx), port 3001
- **Auth & DB**: Supabase (external — keeps existing project at jerhefcpsmcvxkmvyyqe.supabase.co)
- **Payments**: NeuraPay only

## Running the app

The `Start application` workflow runs `npm run dev` which starts both Vite (port 5000) and the Express API (port 3001) concurrently. Vite proxies `/api` requests to the Express server.

## Required Secrets

Add these in Replit Secrets:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for server-side admin operations)
- `NEURAPAY_SECRET_KEY` — NeuraPay secret key (for transaction initialization and verification)
- `NEURAPAY_BASE_URL` — NeuraPay API base URL (usually `https://neurapay.com.ng/api/v1`)
- `NEURAPAY_PUBLIC_KEY` — NeuraPay public key used by the frontend for wallet funding
- `NEURAPAY_WEBHOOK_SECRET` — NeuraPay webhook signature secret
- `ADMIN_EMAIL` — Email address to auto-grant admin role on startup

The Supabase public keys (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are already set in .replit shared env.

## User Preferences

- Keep Supabase as the auth/database provider (do not replace with Replit Auth)
- Admin email: kamzybotsmedia@gmail.com
