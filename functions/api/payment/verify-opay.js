// Cloudflare Pages Function — POST /api/payment/verify-opay
// Verifies an Opay payment after redirect (cashier/status) and credits the wallet.
// Docs: https://documentation.opaycheckout.com/query-payment-status

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const merchantId = env.OPAY_MERCHANT_ID || "";
  const secretKey = env.OPAY_SECRET_KEY || "";
  const baseUrl = env.OPAY_BASE_URL || "https://liveapi.opaycheckout.com";

  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);
  if (!merchantId || !secretKey) return json({ error: "Opay not configured" }, 500);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const { reference, userId } = body;
  if (!reference || !userId) return json({ error: "reference and userId required" }, 400);
  if (userId !== user.id) return json({ error: "Forbidden" }, 403);

  const intentRes = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${userId}&provider=eq.opay&limit=1`,
  );
  const intents = intentRes.ok ? await intentRes.json() : [];
  const intent = intents[0];
  if (intent?.status === "success")
    return json({ success: true, amount: Number(intent.amount), alreadyCredited: true });

  const payload = { country: "NG", reference };
  const payloadStr = JSON.stringify(payload);
  const signature = await hmacSha512Hex(secretKey, payloadStr);

  const verifyRes = await fetch(`${baseUrl}/api/v1/international/cashier/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signature}`,
      MerchantId: merchantId,
      "Content-Type": "application/json",
    },
    body: payloadStr,
  });

  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || verifyData.code !== "00000")
    return json({ error: verifyData.message || "Could not reach Opay — try again" }, 502);

  const txStatus = verifyData?.data?.status;
  if (txStatus !== "SUCCESS")
    return json(
      {
        error: `Payment not confirmed (status: ${txStatus || "unknown"}). If charged, contact support.`,
      },
      400,
    );

  const amountKobo = Number(verifyData?.data?.amount?.total ?? 0);
  const amount = amountKobo / 100;

  await ensureWallet(supabaseUrl, serviceKey, userId);

  const rpcRes = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/rpc/credit_wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _user_id: userId,
      _amount: amount,
      _provider: "opay",
      _reference: reference,
      _description: `Wallet funded via Opay (₦${amount.toLocaleString("en-NG")})`,
    }),
  });

  if (!rpcRes.ok) {
    const msg = await rpcRes.text();
    console.error("[verify-opay] credit_wallet error:", msg);
    return json({ error: "Failed to credit wallet — contact support with ref: " + reference }, 500);
  }

  if (intent) {
    await sbFetch(supabaseUrl, serviceKey, `/rest/v1/payment_intents?id=eq.${intent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "success", updated_at: new Date().toISOString() }),
    });
  } else {
    await sbFetch(supabaseUrl, serviceKey, "/rest/v1/payment_intents", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        provider: "opay",
        reference,
        amount,
        currency: "NGN",
        status: "success",
        updated_at: new Date().toISOString(),
      }),
    });
  }

  return json({ success: true, amount, alreadyCredited: false });
}

async function hmacSha512Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getUser(supabaseUrl, serviceKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  return res.ok ? res.json() : null;
}

async function ensureWallet(supabaseUrl, serviceKey, userId) {
  const res = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/wallets?user_id=eq.${userId}&limit=1`,
  );
  const rows = res.ok ? await res.json() : [];
  if (rows.length > 0) return rows[0];
  const cr = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, balance: 0, currency: "NGN" }),
  });
  const created = cr.ok ? await cr.json() : [];
  return Array.isArray(created) ? created[0] : created;
}

function sbFetch(supabaseUrl, serviceKey, path, extra = {}) {
  const { headers: h = {}, ...rest } = extra;
  return fetch(`${supabaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, ...h },
    ...rest,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
