// Cloudflare Pages Function — POST /api/webhooks/neurapay
// Production URL: https://kamzybotsmedia.store/api/webhooks/neurapay
//
// Validates the NeuraPay webhook signature (HMAC-SHA256 over the raw body
// using NEURAPAY_WEBHOOK_SECRET) when one is configured, then re-confirms the
// transaction with NeuraPay server-to-server before crediting the wallet
// exactly once. When the signature is valid but NeuraPay does not expose the
// settled transfer through its transaction lookup, the signed body itself is
// used as the confirmation source — otherwise a genuinely paid transfer would
// never reach the wallet.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  extractValue,
  verifyWebhookSignature,
  findIntent,
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

    let signatureVerified = false;
    if (cfg.webhookSecret) {
      if (!signature) {
        console.error("[neurapay webhook] missing signature header");
        return json({ error: "Missing signature" }, 401);
      }
      if (!(await verifyWebhookSignature(rawBody, signature, cfg.webhookSecret))) {
        console.error("[neurapay webhook] invalid signature");
        return json({ error: "Invalid signature" }, 401);
      }
      signatureVerified = true;
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

    const body = payload?.data ?? payload;

    const reference = String(
      extractValue(payload, [
        "reference",
        "payment_reference",
        "paymentReference",
        "merchantReference",
        "merchant_reference",
      ]) ?? "",
    ).trim();
    const providerReference = String(
      extractValue(payload, [
        "transaction_reference",
        "transactionReference",
        "transaction_id",
        "transactionId",
      ]) ?? "",
    ).trim();
    const accountNumber = String(
      extractValue(payload, [
        "account_number",
        "accountNumber",
        "virtual_account_number",
        "virtualAccountNumber",
      ]) ?? "",
    ).trim();

    console.log("[neurapay webhook] received", {
      reference,
      providerReference,
      hasAccountNumber: Boolean(accountNumber),
      event: payload?.event ?? payload?.type ?? null,
      signatureVerified,
    });

    if (!reference && !providerReference && !accountNumber)
      return json({ error: "Missing reference" }, 400);

    const intent = await findIntent(supabaseUrl, serviceKey, {
      reference,
      providerReference,
      accountNumber,
    });
    if (!intent) {
      console.error("[neurapay webhook] no matching payment intent", {
        reference,
        providerReference,
      });
      // 200 so NeuraPay does not retry forever on a foreign reference.
      return json({ received: true, credited: false, reason: "unknown_reference" });
    }
    if (intent.status === "success") {
      console.log("[neurapay webhook] already credited", { reference: intent.reference });
      return json({ received: true, credited: false, alreadyCredited: true });
    }

    // The webhook body alone is only trusted when its HMAC signature checked
    // out AND it reports a settled payment; otherwise NeuraPay must confirm it.
    const outcome = await verifyAndCreditIntent(cfg, supabaseUrl, serviceKey, intent, {
      providerReference,
      trustedPayload: signatureVerified ? body : null,
    });

    if (!outcome.success) {
      // Ask NeuraPay to retry later while the payment is still unconfirmed.
      const retryable = outcome.status === "pending";
      console.warn("[neurapay webhook] not credited", {
        reference: intent.reference,
        status: outcome.status,
      });
      return json(
        { received: true, credited: false, reason: outcome.status },
        retryable ? 503 : 200,
      );
    }

    console.log("[neurapay webhook] credited", {
      reference: intent.reference,
      amount: outcome.amount,
      alreadyCredited: Boolean(outcome.alreadyCredited),
    });

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
