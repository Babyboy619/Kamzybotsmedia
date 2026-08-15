// Cloudflare Pages Function — POST /api/webhooks/neurapay
// Production URL: https://kamzybotsmedia.store/api/webhooks/neurapay
//
// Validates the NeuraPay webhook signature (HMAC-SHA256 over the raw body
// using NEURAPAY_WEBHOOK_SECRET), re-confirms the transaction with NeuraPay,
// then credits the wallet exactly once.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  neuraPayRequest,
  isPaidStatus,
  extractValue,
  verifyWebhookSignature,
  getIntent,
  creditWalletOnce,
} from "../_neurapay.js";

export const onRequestOptions = optionsResponse;

export async function onRequestPost({ request, env }) {
  try {
    const supabaseUrl = readEnv(env, "SUPABASE_URL") || readEnv(env, "VITE_SUPABASE_URL");
    const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
    const cfg = neuraPayConfig(env);

    if (!supabaseUrl || !serviceKey || !cfg.webhookSecret) {
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

    if (!signature) return json({ error: "Missing signature" }, 401);
    if (!(await verifyWebhookSignature(rawBody, signature, cfg.webhookSecret))) {
      console.error("[neurapay webhook] invalid signature");
      return json({ error: "Invalid signature" }, 401);
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

    const eventStatus = extractValue(payload, [
      "status",
      "payment_status",
      "paymentStatus",
      "event",
    ]);
    if (!isPaidStatus(eventStatus)) {
      // Acknowledge non-terminal events so NeuraPay stops retrying.
      console.log("[neurapay webhook] ignoring event", { reference, eventStatus });
      return json({ received: true, credited: false, status: String(eventStatus ?? "unknown") });
    }

    const intent = await getIntent(supabaseUrl, serviceKey, reference);
    if (!intent) {
      console.error("[neurapay webhook] unknown reference", reference);
      // 200 so NeuraPay does not retry forever on a foreign reference.
      return json({ received: true, credited: false, reason: "unknown_reference" });
    }
    if (intent.status === "success") {
      return json({ received: true, credited: false, alreadyCredited: true });
    }

    // Never trust the webhook body alone — re-confirm with NeuraPay.
    const result = await neuraPayRequest(
      cfg,
      `${cfg.verifyPath}/${encodeURIComponent(reference)}`,
      {},
      "GET",
    );
    const verified = result.json?.data ?? result.json;
    const remoteStatus = extractValue(verified, ["status", "payment_status", "paymentStatus"]);

    if (!result.ok || !isPaidStatus(remoteStatus)) {
      console.error("[neurapay webhook] re-verification failed", {
        reference,
        status: result.status,
        remoteStatus,
        networkError: result.networkError,
        body: result.raw?.slice(0, 800),
      });
      // 503 asks NeuraPay to retry later; the wallet stays untouched.
      return json({ received: true, credited: false, reason: "verification_failed" }, 503);
    }

    const expected = Number(intent.amount);
    const paid = Number(
      extractValue(verified, ["amountPaid", "amount_paid", "amount", "value"]),
    );

    if (Number.isFinite(paid) && paid > 0 && Math.abs(paid - expected) > 0.5) {
      console.error("[neurapay webhook] amount mismatch", { reference, expected, paid });
      return json({ received: true, credited: false, reason: "amount_mismatch" }, 200);
    }

    const outcome = await creditWalletOnce(supabaseUrl, serviceKey, {
      userId: intent.user_id,
      amount: expected,
      reference,
    });

    if (outcome.error) {
      return json({ received: true, credited: false, reason: "credit_failed" }, 503);
    }

    return json({
      received: true,
      credited: outcome.credited,
      alreadyCredited: outcome.alreadyCredited,
    });
  } catch (err) {
    console.error(
      "[neurapay webhook] unhandled error",
      err instanceof Error ? err.stack : String(err),
    );
    return json({ received: false, error: "Internal error" }, 500);
  }
}
