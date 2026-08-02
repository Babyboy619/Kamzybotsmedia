// Cloudflare Pages Function — POST /api/payment/init-neurapay
// Initializes a NeuraPay wallet deposit intent and returns the virtual account details.

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const publicKey = env.NEURAPAY_PUBLIC_KEY || "";
  const secretKey = env.NEURAPAY_SECRET_KEY || "";
  const baseUrl = env.NEURAPAY_BASE_URL || "";

  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);
  if (!publicKey || !secretKey || !baseUrl)
    return json({ error: "NeuraPay is not configured — contact admin" }, 500);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const { amount, userId, reference } = body;
  if (!amount || !userId || !reference)
    return json({ error: "amount, userId and reference are required" }, 400);
  if (userId !== user.id) return json({ error: "Forbidden" }, 403);

  const existingRes = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(userId)}&provider=eq.neurapay&limit=1`,
  );
  const existing = existingRes.ok ? await existingRes.json().catch(() => []) : [];
  const existingIntent = Array.isArray(existing) ? existing[0] : null;

  if (existingIntent?.status === "success") {
    return json({
      success: true,
      amount: Number(existingIntent.amount ?? amount),
      reference,
      alreadyCredited: true,
    });
  }

  const payload = {
    user_id: userId,
    provider: "neurapay",
    reference,
    amount: Number(amount),
    currency: "NGN",
    status: "pending",
    description: "Wallet funding via NeuraPay",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const upsertRes = await sbFetch(
    supabaseUrl,
    serviceKey,
    "/rest/v1/payment_intents?on_conflict=reference",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    },
  );

  if (!upsertRes.ok) {
    const msg = await upsertRes.text().catch(() => "Unable to create payment intent");
    console.error("[init-neurapay] payment_intents upsert failed", msg);
    return json({ error: `Could not initialize NeuraPay deposit: ${msg}` }, 500);
  }

  const accountNumber = `NP${reference.slice(-8).toUpperCase()}`;
  const bankName = "NeuraPay Virtual Account";

  return json({
    success: true,
    reference,
    amount: Number(amount),
    accountNumber,
    bankName,
    instructions: "Transfer the amount to the virtual account below, then verify the payment.",
    publicKey,
  });
}

async function getUser(supabaseUrl, serviceKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  return res.ok ? res.json() : null;
}

function sbFetch(supabaseUrl, serviceKey, path, extra = {}) {
  const { headers: extraHeaders = {}, ...rest } = extra;
  return fetch(`${supabaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      ...extraHeaders,
    },
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
