// Cloudflare Pages Function — POST /api/payment/reconcile-neurapay
// Re-checks pending NeuraPay intents for the signed-in user and credits only
// when NeuraPay confirms payment. This is idempotent and safe to run multiple times.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  neuraPayRequest,
  isPaidStatus,
  extractValue,
  sbFetch,
  getUser,
  getIntent,
  creditWalletOnce,
} from "../_neurapay.js";

export const onRequestOptions = optionsResponse;

export async function onRequestPost({ request, env }) {
  try {
    const supabaseUrl = readEnv(env, "SUPABASE_URL") || readEnv(env, "VITE_SUPABASE_URL");
    const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
    const cfg = neuraPayConfig(env);

    if (!supabaseUrl || !serviceKey || !cfg.secretKey) {
      return json({ error: "Payments are temporarily unavailable. Please try again later." }, 503);
    }

    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const targetReference = String(body?.reference || "").trim();

    let intents = [];
    if (targetReference) {
      const intent = await getIntent(supabaseUrl, serviceKey, targetReference, user.id);
      intents = intent ? [intent] : [];
    } else {
      const res = await sbFetch(
        supabaseUrl,
        serviceKey,
        `/rest/v1/payment_intents?user_id=eq.${encodeURIComponent(user.id)}&provider=eq.neurapay&status=in.(pending,failed)&order=updated_at.asc&limit=50`,
      );
      if (res.ok) {
        intents = await res.json().catch(() => []);
      }
    }

    let reconciled = 0;
    for (const intent of intents) {
      if (!intent || intent.status === "success") continue;

      const verifyResult = await neuraPayRequest(
        cfg,
        `${cfg.verifyPath}/${encodeURIComponent(intent.reference)}`,
        {},
        "GET",
      );

      if (verifyResult.status === 404) continue;
      if (!verifyResult.ok) {
        console.warn("[reconcile-neurapay] verify failed", {
          reference: intent.reference,
          status: verifyResult.status,
          networkError: verifyResult.networkError,
        });
        continue;
      }

      const payload = verifyResult.json?.data ?? verifyResult.json;
      const remoteStatus = String(
        extractValue(payload, ["status", "payment_status", "paymentStatus", "transactionStatus"]) ??
          "",
      ).toLowerCase();

      if (!isPaidStatus(remoteStatus)) {
        const failed = [
          "failed",
          "cancelled",
          "canceled",
          "declined",
          "reversed",
          "expired",
        ].includes(remoteStatus);
        if (failed) {
          await sbFetch(
            supabaseUrl,
            serviceKey,
            `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(intent.reference)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
            },
          );
        }
        continue;
      }

      const expected = Number(intent.amount);
      const paid = Number(
        extractValue(payload, ["amountPaid", "amount_paid", "amount", "settledAmount", "value"]),
      );
      if (Number.isFinite(paid) && paid > 0 && Math.abs(paid - expected) > 0.5) {
        await sbFetch(
          supabaseUrl,
          serviceKey,
          `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(intent.reference)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
          },
        );
        continue;
      }

      const outcome = await creditWalletOnce(supabaseUrl, serviceKey, {
        userId: intent.user_id,
        amount: expected,
        reference: intent.reference,
      });

      if (!outcome.error) {
        reconciled += 1;
      }
    }

    return json({
      success: true,
      reconciled,
      scanned: intents.length,
      reference: targetReference || null,
    });
  } catch (error) {
    console.error("[reconcile-neurapay] unhandled error", error);
    return json({ error: "Payment reconciliation failed. Please try again." }, 500);
  }
}
