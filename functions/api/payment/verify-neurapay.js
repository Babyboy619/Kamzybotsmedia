// Cloudflare Pages Function — POST /api/payment/verify-neurapay
// Confirms a NeuraPay payment with NeuraPay itself and credits the wallet
// exactly once. Never credits on an unverified / failed transaction.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  neuraPayRequest,
  neuraPayErrorMessage,
  isNeuraPaySuccess,
  isPaidStatus,
  extractValue,
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
      console.error("[verify-neurapay] server not configured");
      return json({ error: "Payments are temporarily unavailable. Please try again later." }, 503);
    }

    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const body = await request.json().catch(() => ({}));
    const reference = String(body?.reference || "").trim();
    if (!reference) return json({ error: "reference is required" }, 400);
    if (body?.userId && body.userId !== user.id) return json({ error: "Forbidden" }, 403);

    // The intent is the source of truth for owner + amount. A client cannot
    // verify someone else's reference: the lookup is scoped to the caller.
    const intent = await getIntent(supabaseUrl, serviceKey, reference, user.id);
    if (!intent) return json({ error: "Invalid or expired payment reference" }, 404);

    if (intent.status === "success") {
      return json({
        success: true,
        status: "successful",
        amount: Number(intent.amount),
        alreadyCredited: true,
      });
    }

    const result = await neuraPayRequest(cfg, cfg.verifyPath, {
      reference,
      transactionId: intent.provider_reference || undefined,
      ...(cfg.businessId ? { businessId: cfg.businessId } : {}),
    });

    if (!result.ok) {
      console.error("[verify-neurapay] NeuraPay verify call failed", {
        status: result.status,
        networkError: result.networkError,
        path: cfg.verifyPath,
        method: cfg.method,
        body: result.raw?.slice(0, 800),
      });
      // Upstream problem — the payment may still be valid, so stay "pending".
      return json(
        {
          success: false,
          status: "pending",
          error: neuraPayErrorMessage(result, "Could not confirm this payment yet"),
        },
        200,
      );
    }

    const remoteStatus = String(
      extractValue(result.json, [
        "status",
        "payment_status",
        "paymentStatus",
        "transactionStatus",
      ]) ?? "",
    ).toLowerCase();

    if (!isNeuraPaySuccess(result.json)) {
      const failed = [
        "failed",
        "cancelled",
        "canceled",
        "declined",
        "reversed",
        "expired",
      ].includes(remoteStatus);
      console.warn("[verify-neurapay] not successful", { reference, remoteStatus });
      return json(
        {
          success: false,
          status: failed ? remoteStatus : "pending",
          error: failed
            ? "This payment was not completed."
            : "Payment is still pending. Try again in a moment.",
        },
        200,
      );
    }

    // ── Amount + currency checks before any credit ──────────────────────────
    const expected = Number(intent.amount);
    const paidRaw = extractValue(result.json, [
      "amountPaid",
      "amount_paid",
      "amount",
      "settledAmount",
      "value",
    ]);
    const paid = Number(paidRaw);
    if (Number.isFinite(paid) && paid > 0 && Math.abs(paid - expected) > 0.5) {
      console.error("[verify-neurapay] amount mismatch", { reference, expected, paid });
      return json(
        {
          success: false,
          status: "failed",
          error: "Payment amount did not match. Contact support.",
        },
        200,
      );
    }

    const currency = String(
      extractValue(result.json, ["currency", "currency_code"]) ?? "NGN",
    ).toUpperCase();
    if (currency && currency !== "NGN") {
      console.error("[verify-neurapay] currency mismatch", { reference, currency });
      return json(
        { success: false, status: "failed", error: "Unsupported payment currency." },
        200,
      );
    }

    const outcome = await creditWalletOnce(supabaseUrl, serviceKey, {
      userId: intent.user_id,
      amount: expected,
      reference,
    });

    if (outcome.error)
      return json({ success: false, status: "pending", error: outcome.error }, 200);

    return json({
      success: true,
      status: "successful",
      amount: expected,
      alreadyCredited: outcome.alreadyCredited,
    });
  } catch (err) {
    console.error(
      "[verify-neurapay] unhandled error",
      err instanceof Error ? err.stack : String(err),
    );
    return json({ error: "Something went wrong verifying this payment. Please try again." }, 500);
  }
}
