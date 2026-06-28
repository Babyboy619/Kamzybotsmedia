// Cloudflare Pages Function — POST /api/payment/init-opay
// Initializes an OPay Cashier payment and returns a hosted checkout URL.
// Docs: https://documentation.opaycheckout.com/cashier-create

export async function onRequestPost({ request, env }) {
  const supabaseUrl  = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey   = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const merchantId   = env.OPAY_MERCHANT_ID || "";
  const publicKey    = env.OPAY_PUBLIC_KEY || "";
  const baseUrl       = env.OPAY_BASE_URL || "https://liveapi.opaycheckout.com";

  if (!supabaseUrl || !serviceKey)
    return json({ error: "Server not configured" }, 503);
  if (!merchantId || !publicKey)
    return json({ error: "Opay is not configured — contact admin" }, 500);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const { amount, userId, reference } = body;

  if (!amount || !userId || !reference)
    return json({ error: "amount, userId and reference are required" }, 400);
  if (userId !== user.id)
    return json({ error: "Forbidden" }, 403);

  const siteUrl = env.VITE_SITE_URL || "https://sammystore.pages.dev";

  const initRes = await fetch(`${baseUrl}/api/v1/international/cashier/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publicKey}`,
      MerchantId: merchantId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: "NG",
      reference,
      amount: { total: Math.round(Number(amount) * 100), currency: "NGN" },
      returnUrl: `${siteUrl}/wallet?ref=${reference}&userId=${userId}&provider=opay`,
      callbackUrl: `${siteUrl}/api/webhooks/opay`,
      cancelUrl: `${siteUrl}/wallet?ref=${reference}&userId=${userId}&provider=opay&cancelled=1`,
      expireAt: 1800,
      userInfo: {
        userEmail: user.email,
        userId: user.id,
        userMobile: user.phone || "+2340000000000",
        userName: user.email?.split("@")[0] || "Customer",
      },
      product: {
        name: "Wallet top-up",
        description: `Wallet top-up for ${user.email}`,
      },
    }),
  });

  const initData = await initRes.json().catch(() => ({}));

  if (!initRes.ok || initData.code !== "00000") {
    console.error("[init-opay] init error:", initData);
    return json({ error: initData.message || "Could not initialize Opay payment — try again" }, 502);
  }

  const cashierUrl = initData?.data?.cashierUrl;
  const orderNo    = initData?.data?.orderNo;

  if (!cashierUrl)
    return json({ error: "Opay did not return a checkout URL" }, 502);

  await sbFetch(supabaseUrl, serviceKey, "/rest/v1/payment_intents", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      provider: "opay",
      reference,
      amount: Number(amount),
      currency: "NGN",
      status: "pending",
      raw: { orderNo },
    }),
  });

  return json({ checkoutUrl: cashierUrl, orderNo });
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
