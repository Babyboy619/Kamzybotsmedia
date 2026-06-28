// Cloudflare Pages Function — POST /api/webhooks/opay
// Opay sends payment notification callbacks here; we credit the wallet server-side
// so the user doesn't need to stay on the page.
//
// Configure in Opay Merchant Dashboard → Settings → API:
//   Callback URL → https://yourdomain.com/api/webhooks/opay
//
// Docs: https://documentation.opaycheckout.com/payment-notification

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secretKey   = env.OPAY_SECRET_KEY || "";

  if (!supabaseUrl || !serviceKey || !secretKey)
    return json({ error: "Server not configured" }, 503);

  const rawBody = await request.text();
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Bad JSON" }, 400); }

  const { payload: data, sha512: providedSig } = payload;
  if (!data) return json({ error: "Missing payload" }, 400);

  const expectedSig = await hmacSha512Hex(secretKey, JSON.stringify(data));
  if (!providedSig || expectedSig !== providedSig)
    return json({ error: "Invalid signature" }, 401);

  if (data.status !== "SUCCESS") return json({ received: true });

  const reference = data.reference;
  const amountKobo = Number(data.amount?.total ?? 0);
  const amount = amountKobo / 100;

  if (!reference || amount <= 0) return json({ error: "Missing required fields" }, 400);

  const intentRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&provider=eq.opay&limit=1`);
  const intents = intentRes.ok ? await intentRes.json() : [];
  const intent = intents[0];

  if (!intent) {
    console.error("[Opay webhook] No payment_intent found for reference:", reference);
    return json({ received: true });
  }
  if (intent.status === "success") return json({ received: true, alreadyCredited: true });

  const userId = intent.user_id;

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
    const errText = await rpcRes.text();
    console.error("[Opay webhook] credit_wallet failed:", errText);
    return json({ error: "Failed to credit wallet" }, 500);
  }

  await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/payment_intents?id=eq.${intent.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "success", updated_at: new Date().toISOString() }),
  });

  return json({ received: true, credited: true });
}

async function hmacSha512Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureWallet(supabaseUrl, serviceKey, userId) {
  const res = await sbFetch(supabaseUrl, serviceKey, `/rest/v1/wallets?user_id=eq.${userId}&limit=1`);
  const rows = await res.json();
  if (rows.length > 0) return rows[0];
  const cr = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, balance: 0, currency: "NGN" }),
  });
  const created = await cr.json();
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
    headers: { "Content-Type": "application/json" },
  });
}
