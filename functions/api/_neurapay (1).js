// Shared NeuraPay + Supabase helpers for Cloudflare Pages Functions.
// Files prefixed with "_" are NOT routed by Cloudflare Pages Functions.
//
// NeuraPay API surface (probed live against https://neurapay.com.ng/api/v1
// with real live keys + X-Business-Id):
//   POST /api/v1/virtual-accounts        -> 201, generates the funding account
//        body: customer_name, customer_email, amount, reference, currency
//        data: { reference, account_number, bank_name, account_name, ... }
//   GET  /api/v1/transactions/{reference} -> transaction status (404 until paid)
//   POST /api/v1/transactions/*          -> 405 (GET/HEAD only)
// Every request must send Authorization: Bearer <secret> AND X-Business-Id.
// Paths/methods stay env-overridable so they can be corrected from the
// Cloudflare dashboard without a code change.


export const DEFAULT_BASE_URL = "https://neurapay.com.ng/api/v1";
export const NEURAPAY_TIMEOUT_MS = 15000;

export function readEnv(env, key) {
  const value = env?.[key];
  if (value !== undefined && value !== null && value !== "") return String(value);
  const fallback = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return fallback !== undefined && fallback !== null ? String(fallback) : "";
}

export function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-neurapay-signature, x-signature, signature",
    ...extra,
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json" }),
  });
}

export function neuraPayConfig(env) {
  const base = (readEnv(env, "NEURAPAY_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return {
    baseUrl: base,
    secretKey: readEnv(env, "NEURAPAY_SECRET_KEY"),
    publicKey: readEnv(env, "NEURAPAY_PUBLIC_KEY"),
    webhookSecret: readEnv(env, "NEURAPAY_WEBHOOK_SECRET"),
    businessId: readEnv(env, "NEURAPAY_BUSINESS_ID"),
    // Init = generate a dedicated virtual account (POST).
    initPath: (readEnv(env, "NEURAPAY_INIT_PATH") || "virtual-accounts").replace(/^\/+/, ""),
    initMethod: (readEnv(env, "NEURAPAY_INIT_METHOD") || "POST").toUpperCase(),
    // Verify = GET /transactions/{reference}.
    verifyPath: (readEnv(env, "NEURAPAY_VERIFY_PATH") || "transactions").replace(/^\/+/, ""),
    method: (readEnv(env, "NEURAPAY_HTTP_METHOD") || "GET").toUpperCase(),
  };
}

/**
 * Calls NeuraPay and always resolves — never throws — so an upstream outage
 * can never bubble up as an unhandled exception (the old 502 Bad Gateway).
 * Returns { ok, status, json, raw, networkError }.
 */
export async function neuraPayRequest(cfg, path, params, methodOverride) {
  const url = new URL(`${cfg.baseUrl}/${path}`);
  const method = (methodOverride || cfg.method).toUpperCase();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${cfg.secretKey}`,
    "x-api-key": cfg.secretKey,
  };
  // NeuraPay rejects every call without this header.
  if (cfg.businessId) headers["X-Business-Id"] = cfg.businessId;

  const init = { method, headers, signal: AbortSignal.timeout(NEURAPAY_TIMEOUT_MS) };

  if (method === "GET" || method === "HEAD") {
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== "")
        url.searchParams.set(key, String(value));
    }
  } else {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(params ?? {});
  }


  try {
    const res = await fetch(url.toString(), init);
    const raw = await res.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, json: parsed, raw, networkError: null };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      json: null,
      raw: "",
      networkError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function extractValue(payload, keys) {
  const visit = (node) => {
    if (!node || typeof node !== "object") return undefined;
    for (const key of keys) {
      const value = node[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === "object") {
        const found = visit(child);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return visit(payload);
}

const SUCCESS_STATES = ["success", "successful", "paid", "completed", "confirmed"];

export function isPaidStatus(value) {
  return SUCCESS_STATES.includes(String(value ?? "").toLowerCase());
}

export function isNeuraPaySuccess(payload) {
  if (!payload) return false;
  if (payload.success === true || payload.data?.success === true) return true;
  if (isPaidStatus(payload.status) || isPaidStatus(payload.data?.status)) return true;
  return false;
}

export function neuraPayErrorMessage(result, fallback) {
  if (result.networkError) return "Could not reach NeuraPay. Please try again in a moment.";
  const message = extractValue(result.json, ["message", "error", "detail", "errorMessage"]);
  if (message) return String(message);
  return `${fallback} (NeuraPay HTTP ${result.status})`;
}

// ── Supabase (service role) ─────────────────────────────────────────────────

export function sbFetch(supabaseUrl, serviceKey, path, extra = {}) {
  const { headers: extraHeaders = {}, ...rest } = extra;
  return fetch(`${supabaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, ...extraHeaders },
    ...rest,
  });
}

export async function getUser(supabaseUrl, serviceKey, token) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error("[neurapay] getUser failed", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function ensureWallet(supabaseUrl, serviceKey, userId) {
  const res = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = res.ok ? await res.json().catch(() => []) : [];
  if (Array.isArray(rows) && rows.length > 0) return rows[0];
  const create = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, balance: 0, currency: "NGN" }),
  });
  const created = create.ok ? await create.json().catch(() => []) : [];
  return Array.isArray(created) ? created[0] : created;
}

export async function getIntent(supabaseUrl, serviceKey, reference, userId) {
  const scope = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";
  const res = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}${scope}&provider=eq.neurapay&limit=1`,
  );
  const rows = res.ok ? await res.json().catch(() => []) : [];
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

/**
 * Idempotent wallet credit. Claims the intent by flipping
 * pending -> success in a single conditional PATCH; only the request that
 * wins that race performs the credit, so duplicate webhooks / double clicks
 * cannot credit twice.
 */
export async function creditWalletOnce(supabaseUrl, serviceKey, { userId, amount, reference }) {
  const claim = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&provider=eq.neurapay&status=neq.success`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ status: "success", updated_at: new Date().toISOString() }),
    },
  );

  if (!claim.ok) {
    const detail = await claim.text().catch(() => "");
    console.error("[neurapay] intent claim failed", detail);
    return { credited: false, alreadyCredited: false, error: "Could not update payment status" };
  }

  const claimed = await claim.json().catch(() => []);
  if (!Array.isArray(claimed) || claimed.length === 0) {
    // Another request already flipped it to success — nothing more to do.
    return { credited: false, alreadyCredited: true, error: null };
  }

  await ensureWallet(supabaseUrl, serviceKey, userId);

  const rpc = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/rpc/credit_wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _user_id: userId,
      _amount: amount,
      _provider: "neurapay",
      _reference: reference,
      _description: "Wallet funded via NeuraPay",
    }),
  });

  if (!rpc.ok) {
    const detail = await rpc.text().catch(() => "");
    console.error("[neurapay] credit_wallet failed", detail);
    // Roll the claim back so the payment can be retried/reconciled.
    await sbFetch(
      supabaseUrl,
      serviceKey,
      `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "pending", updated_at: new Date().toISOString() }),
      },
    );
    return { credited: false, alreadyCredited: false, error: "Could not credit wallet" };
  }

  return { credited: true, alreadyCredited: false, error: null };
}

export async function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  const normalized = String(signatureHeader).trim().toLowerCase();
  const provided = normalized.startsWith("sha256=") ? normalized.slice(7) : normalized;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (computed.length !== provided.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++)
      diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
    return diff === 0;
  } catch (err) {
    console.error(
      "[neurapay] signature check error",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
