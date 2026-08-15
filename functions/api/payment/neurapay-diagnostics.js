// Cloudflare Pages Function — GET /api/payment/neurapay-diagnostics
// Reports ONLY whether each required server-side variable is readable and
// whether Supabase/NeuraPay are reachable. Never returns a secret value.

import { json, optionsResponse, readEnv, neuraPayConfig, sbFetch } from "../_neurapay.js";

export const onRequestOptions = optionsResponse;

export async function onRequestGet({ env }) {
  const cfg = neuraPayConfig(env);
  const supabaseUrl = readEnv(env, "SUPABASE_URL") || readEnv(env, "VITE_SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const variables = {
    NEURAPAY_SECRET_KEY: Boolean(cfg.secretKey),
    NEURAPAY_PUBLIC_KEY: Boolean(cfg.publicKey),
    NEURAPAY_WEBHOOK_SECRET: Boolean(cfg.webhookSecret),
    NEURAPAY_BUSINESS_ID: Boolean(cfg.businessId),
    NEURAPAY_BASE_URL: cfg.baseUrl,
    NEURAPAY_HTTP_METHOD: cfg.method,
    NEURAPAY_INIT_PATH: cfg.initPath,
    SUPABASE_URL: Boolean(supabaseUrl),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
  };

  // Can the service role actually read payment_intents?
  let paymentIntents = { reachable: false, httpStatus: 0, message: null };
  if (supabaseUrl && serviceKey) {
    try {
      const res = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/payment_intents?select=id&limit=1");
      const body = await res.text().catch(() => "");
      paymentIntents = {
        reachable: res.ok,
        httpStatus: res.status,
        message: res.ok ? null : body.slice(0, 300),
      };
    } catch (err) {
      paymentIntents = {
        reachable: false,
        httpStatus: 0,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return json({ ok: true, variables, paymentIntents });
}
