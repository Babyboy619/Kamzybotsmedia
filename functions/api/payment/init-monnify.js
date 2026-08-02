// Cloudflare Pages Function — POST /api/payment/init-monnify
// Initializes a Monnify transaction and returns a checkout URL.

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const apiKey = env.MONNIFY_API_KEY || "";
  const secretKey = env.MONNIFY_SECRET_KEY || "";
  const contractCode = env.MONNIFY_CONTRACT_CODE || "";
  const baseUrl = env.MONNIFY_BASE_URL || "https://api.monnify.com";

  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);
  if (!apiKey || !secretKey || !contractCode)
    return json({ error: "Monnify is not configured — contact admin" }, 500);

  // Authenticate caller
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const { amount, userId, reference } = body;

  if (!amount || !userId || !reference)
    return json({ error: "amount, userId and reference are required" }, 400);
  if (userId !== user.id) return json({ error: "Forbidden" }, 403);

  // Get Monnify access token
  const credentials = btoa(`${apiKey}:${secretKey}`);
  const tokenRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
  });
  if (!tokenRes.ok) return json({ error: "Could not authenticate with Monnify" }, 502);
  const tokenData = await tokenRes.json();
  const accessToken = tokenData?.responseBody?.accessToken;
  if (!accessToken) return json({ error: "Could not get Monnify access token" }, 502);

  // Initialize transaction
  const siteUrl = env.VITE_SITE_URL || "https://sammystore.pages.dev";
  const initRes = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(amount),
      customerName: user.email?.split("@")[0] || "Customer",
      customerEmail: user.email,
      paymentReference: reference,
      paymentDescription: `Wallet top-up for ${user.email}`,
      currencyCode: "NGN",
      contractCode,
      redirectUrl: `${siteUrl}/wallet?ref=${reference}&userId=${userId}&provider=monnify`,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"],
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    console.error("[init-monnify] init error:", errText);
    return json({ error: "Could not initialize Monnify payment — try again" }, 502);
  }

  const initData = await initRes.json();
  const checkoutUrl = initData?.responseBody?.checkoutUrl;
  const transactionRef = initData?.responseBody?.transactionReference;

  if (!checkoutUrl) return json({ error: "Monnify did not return a checkout URL" }, 502);

  // Save payment_intent with monnify transaction ref in raw
  await sbFetch(supabaseUrl, serviceKey, "/rest/v1/payment_intents", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      provider: "monnify",
      reference,
      amount: Number(amount),
      currency: "NGN",
      status: "pending",
      raw: { transactionReference: transactionRef },
    }),
  });

  return json({ checkoutUrl, transactionReference: transactionRef });
}

async function getUser(supabaseUrl, serviceKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  return res.ok ? res.json() : null;
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
