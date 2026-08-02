// Cloudflare Pages Function — POST /api/payment/verify-neurapay
// Verifies a NeuraPay deposit and credits the user's wallet in Supabase.

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secretKey = env.NEURAPAY_SECRET_KEY || "";
  const baseUrl = env.NEURAPAY_BASE_URL || "";

  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);
  if (!secretKey || !baseUrl)
    return json({ error: "NeuraPay is not configured — contact admin" }, 500);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const { reference, userId } = body;
  if (!reference || !userId) return json({ error: "reference and userId are required" }, 400);
  if (userId !== user.id) return json({ error: "Forbidden" }, 403);

  const intentRes = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(userId)}&provider=eq.neurapay&limit=1`,
  );
  const intents = intentRes.ok ? await intentRes.json().catch(() => []) : [];
  const intent = Array.isArray(intents) ? intents[0] : null;

  if (!intent) return json({ error: "Invalid or expired payment reference" }, 400);
  if (intent.status === "success")
    return json({ success: true, amount: Number(intent.amount), alreadyCredited: true });

  const verifyUrl = `${baseUrl}/v1/transactions/verify`;
  const verifyPayload = { reference, amount: Number(intent.amount ?? 0) };
  console.log("[NeuraPay verify] request", { verifyUrl, verifyPayload });

  let verifyRes;
  let verifyBody;
  try {
    verifyRes = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verifyPayload),
      signal: AbortSignal.timeout(10000),
    });
    verifyBody = await verifyRes.text();
    console.log("[NeuraPay verify] status", verifyRes.status);
    console.log("[NeuraPay verify] body", verifyBody);
  } catch (err) {
    console.error("[NeuraPay verify] request error", err);
    return json(
      { error: `NeuraPay verification request failed: ${err instanceof Error ? err.message : String(err)}` },
      502,
    );
  }

  let responseJson;
  try {
    responseJson = JSON.parse(verifyBody || "null");
  } catch (err) {
    console.error("[NeuraPay verify] invalid JSON", err, verifyBody);
    return json({ error: `NeuraPay returned invalid JSON: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const success = responseJson?.success === true || responseJson?.status === "success";
  if (!verifyRes.ok || !success) {
    const errorMessage =
      String(responseJson?.error ?? responseJson?.message ?? `NeuraPay verification failed with status ${verifyRes.status}`);
    console.error("[NeuraPay verify] failed", { errorMessage, responseJson });
    return json({ error: errorMessage }, 400);
  }

  const amount = Number(intent.amount ?? 0);
  await ensureWallet(supabaseUrl, serviceKey, userId);

  const rpcRes = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/rpc/credit_wallet", {
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

  if (!rpcRes.ok) {
    const msg = await rpcRes.text().catch(() => "Unable to credit wallet");
    console.error("[NeuraPay verify] credit_wallet failed", msg);
    return json({ error: `Failed to credit wallet: ${msg}` }, 500);
  }

  await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "success", updated_at: new Date().toISOString() }),
    },
  );

  return json({ success: true, amount, alreadyCredited: false });
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
    `/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = res.ok ? await res.json().catch(() => []) : [];
  if (rows.length > 0) return rows[0];
  const create = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/wallets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, balance: 0, currency: "NGN" }),
  });
  const created = create.ok ? await create.json().catch(() => []) : [];
  return Array.isArray(created) ? created[0] : created;
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
