// Cloudflare Pages Function — POST /api/webhooks/neurapay
// Production URL: https://kamzybotsmedia.store/api/webhooks/neurapay
//
// Validates the NeuraPay webhook signature (HMAC-SHA256 over the raw body
// using NEURAPAY_WEBHOOK_SECRET) when one is configured, then ALWAYS
// re-confirms the transaction with NeuraPay server-to-server before crediting
// the wallet exactly once. The webhook body alone is never trusted.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  extractValue,
  verifyWebhookSignature,
  getIntent,
  verifyAndCreditIntent,
} from "../_neurapay.js";

export const onRequestOptions = optionsResponse;

export async function onRequestPost({ request, env }) {
  try {
    const supabaseUrl = readEnv(env, "SUPABASE_URL") || readEnv(env, "VITE_SUPABASE_URL");
    const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
    const cfg = neuraPayConfig(env);

    if (!supabaseUrl || !serviceKey || !cfg.secretKey) {
      console.error("[neurapay webhook] server not configured");
      return json({ error: "Server not configured" }, 503);
    }

    const rawBody = await request.text();

    const signature =
      request.headers.get("x-neurapay-signature") ||
      request.headers.get("x-webhook-signature") ||
      request.headers.get("x-signature") ||
      request.headers.get("signature") ||
      "";

    if (cfg.webhookSecret) {
      if (!signature) {
        console.error("[neurapay webhook] missing signature header");
        return json({ error: "Missing signature" }, 401);
      }
      if (!(await verifyWebhookSignature(rawBody, signature, cfg.webhookSecret))) {
        console.error("[neurapay webhook] invalid signature");
        return json({ error: "Invalid signature" }, 401);
      }
      console.log("[neurapay webhook] signature verified");
    } else {
      // No signing secret configured yet. The notification is treated purely as
      // a hint: nothing is credited until NeuraPay confirms the transaction on
      // the server-to-server lookup below, so this stays safe.
      console.warn(
        "[neurapay webhook] NEURAPAY_WEBHOOK_SECRET not set — accepting unsigned notification, credit still requires server-side verification",
      );
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const reference = String(
      extractValue(payload, [
        "reference",
        "payment_reference",
        "paymentReference",
        "merchantReference",
      ]) ?? "",
    ).trim();
    if (!reference) return json({ error: "Missing reference" }, 400);
    console.log("[neurapay webhook] received", { reference });

    const intent = await getIntent(supabaseUrl, serviceKey, reference);
    if (!intent) {
      console.error("[neurapay webhook] unknown reference", reference);
      // 200 so NeuraPay does not retry forever on a foreign reference.
      return json({ received: true, credited: false, reason: "unknown_reference" });
    }
    if (intent.status === "success") {
      console.log("[neurapay webhook] already credited", { reference });
      return json({ received: true, credited: false, alreadyCredited: true });
    }

    // Never trust the webhook body — re-confirm, check amount + currency,
    // then credit idempotently.
    const outcome = await verifyAndCreditIntent(cfg, supabaseUrl, serviceKey, intent);

    if (!outcome.success) {
      // Ask NeuraPay to retry later while the payment is still unconfirmed.
      const retryable = outcome.status === "pending";
      console.warn("[neurapay webhook] not credited", { reference, status: outcome.status });
      return json(
        { received: true, credited: false, reason: outcome.status },
        retryable ? 503 : 200,
      );
    }

    return json({
      received: true,
      credited: !outcome.alreadyCredited,
      alreadyCredited: Boolean(outcome.alreadyCredited),
    });
  } catch (err) {
    console.error(
      "[neurapay webhook] unhandled error",
      err instanceof Error ? err.stack : String(err),
    );
    return json({ received: false, error: "Internal error" }, 500);
  }
}

