// Cloudflare Pages Function — POST /api/payment/reconcile-neurapay
// Sweeps the authenticated user's pending NeuraPay intents, confirms each one
// server-to-server with NeuraPay and credits the wallet exactly once.
// This is the safety net for payments completed while the user was away:
// it needs no webhook, no callback URL and no client-side state.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  getUser,
  listPendingIntents,
  verifyAndCreditIntent,
} from "../_neurapay.js";

export const onRequestOptions = optionsResponse;

export async function onRequestPost({ request, env }) {
  try {
    const supabaseUrl = readEnv(env, "SUPABASE_URL") || readEnv(env, "VITE_SUPABASE_URL");
    const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
    const cfg = neuraPayConfig(env);
    if (!supabaseUrl || !serviceKey || !cfg.secretKey)
      return json({ error: "Payments are temporarily unavailable." }, 503);

    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const pending = await listPendingIntents(supabaseUrl, serviceKey, user.id);
    console.log("[reconcile-neurapay] pending intents", { userId: user.id, count: pending.length });

    let creditedCount = 0;
    let creditedAmount = 0;
    const results = [];
    for (const intent of pending) {
      const outcome = await verifyAndCreditIntent(cfg, supabaseUrl, serviceKey, intent);
      if (outcome.success && !outcome.alreadyCredited) {
        creditedCount += 1;
        creditedAmount += Number(outcome.amount ?? 0);
      }
      results.push({ reference: intent.reference, status: outcome.status });
    }

    return json({ success: true, pending: pending.length, creditedCount, creditedAmount, results });
  } catch (err) {
    console.error(
      "[reconcile-neurapay] unhandled error",
      err instanceof Error ? err.stack : String(err),
    );
    return json({ error: "Could not check your pending payments right now." }, 500);
  }
}
