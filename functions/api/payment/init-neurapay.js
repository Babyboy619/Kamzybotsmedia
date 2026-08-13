// Cloudflare Pages Function — POST /api/payment/init-neurapay
// Creates a pending NeuraPay wallet-funding intent and asks NeuraPay to
// initialize the transaction. NEVER credits the wallet.

import {
  json,
  optionsResponse,
  readEnv,
  neuraPayConfig,
  neuraPayRequest,
  neuraPayErrorMessage,
  isNeuraPaySuccess,
  extractValue,
  sbFetch,
  getUser,
  getIntent,
} from "../_neurapay.js";

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;

export const onRequestOptions = optionsResponse;

export async function onRequestPost({ request, env }) {
  try {
    const supabaseUrl = readEnv(env, "SUPABASE_URL") || readEnv(env, "VITE_SUPABASE_URL");
    const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
    const siteUrl = readEnv(env, "VITE_SITE_URL") || "https://kamzybotsmedia.store";
    const cfg = neuraPayConfig(env);

    if (!supabaseUrl || !serviceKey) {
      console.error("[init-neurapay] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Payments are temporarily unavailable. Please try again later." }, 503);
    }
    if (!cfg.secretKey) {
      console.error("[init-neurapay] missing NEURAPAY_SECRET_KEY");
      return json({ error: "Payments are temporarily unavailable. Please try again later." }, 503);
    }

    // ── Authenticate ────────────────────────────────────────────────────────
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    // ── Validate input ──────────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount);
    const reference = String(body?.reference || "").trim();

    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return json(
        { error: `Enter an amount between ₦${MIN_AMOUNT} and ₦${MAX_AMOUNT.toLocaleString()}.` },
        400,
      );
    }
    if (!/^[A-Za-z0-9._-]{8,64}$/.test(reference)) {
      return json({ error: "Invalid payment reference" }, 400);
    }
    // The wallet is always credited to the authenticated user — a client-supplied
    // userId can never redirect funds to another account.
    const userId = user.id;
    if (body?.userId && body.userId !== userId) return json({ error: "Forbidden" }, 403);

    // ── Idempotency ─────────────────────────────────────────────────────────
    const existing = await getIntent(supabaseUrl, serviceKey, reference, userId);
    if (existing?.status === "success") {
      return json({
        success: true,
        reference,
        amount: Number(existing.amount ?? amount),
        alreadyCredited: true,
      });
    }

    // ── Record the pending intent BEFORE calling NeuraPay, so a webhook that
    //    arrives before our response can still resolve the payment. ──────────
    const nowIso = new Date().toISOString();
    const upsert = await sbFetch(
      supabaseUrl,
      serviceKey,
      "/rest/v1/payment_intents?on_conflict=reference",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          provider: "neurapay",
          reference,
          amount,
          currency: "NGN",
          status: "pending",
          description: "Wallet funding via NeuraPay",
          created_at: nowIso,
          updated_at: nowIso,
        }),
      },
    );

    if (!upsert.ok) {
      console.error(
        "[init-neurapay] payment_intents upsert failed",
        await upsert.text().catch(() => ""),
      );
      return json({ error: "Could not start this payment. Please try again." }, 500);
    }

    // ── Call NeuraPay ───────────────────────────────────────────────────────
    const params = {
      amount,
      reference,
      currency: "NGN",
      email: user.email || "",
      customerEmail: user.email || "",
      customerName: (user.email || "customer").split("@")[0],
      description: `Wallet funding (${reference})`,
      callbackUrl: `${siteUrl}/wallet?ref=${encodeURIComponent(reference)}&provider=neurapay`,
      redirectUrl: `${siteUrl}/wallet?ref=${encodeURIComponent(reference)}&provider=neurapay`,
    };
    if (cfg.businessId) params.businessId = cfg.businessId;

    const result = await neuraPayRequest(cfg, cfg.initPath, params);

    if (!result.ok || !isNeuraPaySuccess(result.json)) {
      // Full diagnostics stay server-side; the user gets a safe message.
      console.error("[init-neurapay] NeuraPay init failed", {
        status: result.status,
        networkError: result.networkError,
        path: cfg.initPath,
        method: cfg.method,
        body: result.raw?.slice(0, 800),
      });
      await sbFetch(
        supabaseUrl,
        serviceKey,
        `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
        },
      );
      return json({ error: neuraPayErrorMessage(result, "Could not start this payment") }, 400);
    }

    // Persist whatever NeuraPay gave us (its own transaction id + raw payload).
    const providerReference = extractValue(result.json, [
      "transactionId",
      "transaction_id",
      "transactionReference",
      "transaction_reference",
      "id",
      "reference",
    ]);

    await sbFetch(
      supabaseUrl,
      serviceKey,
      `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          raw: result.json,
          provider_reference: providerReference ? String(providerReference) : null,
          updated_at: new Date().toISOString(),
        }),
      },
    ).catch(() => {});

    const paymentUrl = extractValue(result.json, [
      "paymentUrl",
      "payment_url",
      "checkoutUrl",
      "checkout_url",
      "authorization_url",
      "link",
      "url",
    ]);
    const accountNumber = extractValue(result.json, [
      "accountNumber",
      "account_number",
      "virtualAccountNumber",
      "virtual_account_number",
      "accountNo",
      "account_no",
    ]);
    const bankName = extractValue(result.json, ["bankName", "bank_name", "bank", "accountBank"]);

    return json({
      success: true,
      reference,
      amount,
      providerReference: providerReference ? String(providerReference) : null,
      paymentUrl: paymentUrl ? String(paymentUrl) : null,
      accountNumber: accountNumber ? String(accountNumber) : null,
      bankName: bankName ? String(bankName) : null,
      instructions: paymentUrl
        ? "Continue to NeuraPay to complete your payment, then return here to verify."
        : "Transfer the exact amount to the account below, then tap Verify Payment.",
    });
  } catch (err) {
    // Nothing may escape: an uncaught throw is what produced 502 Bad Gateway.
    console.error(
      "[init-neurapay] unhandled error",
      err instanceof Error ? err.stack : String(err),
    );
    return json({ error: "Something went wrong starting this payment. Please try again." }, 500);
  }
}
