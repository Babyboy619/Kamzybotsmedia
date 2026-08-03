// Cloudflare Pages Function — POST /api/payment/init-neurapay
// Initializes a NeuraPay wallet deposit intent and forwards the request to NeuraPay.

export async function onRequestPost({ request, env }) {
  try {
    const supabaseUrl = readEnvValue(env, "VITE_SUPABASE_URL") || readEnvValue(env, "SUPABASE_URL") || "";
    const serviceKey = readEnvValue(env, "SUPABASE_SERVICE_ROLE_KEY") || "";
    const publicKey = readEnvValue(env, "NEURAPAY_PUBLIC_KEY") || "";
    const secretKey = readEnvValue(env, "NEURAPAY_SECRET_KEY") || "";
    const baseUrl = readEnvValue(env, "NEURAPAY_BASE_URL") || "https://api.neurapay.co";
    const siteUrl = readEnvValue(env, "VITE_SITE_URL") || "https://sammystore.pages.dev";
    const testMode = isNeuraPayTestMode(env);

    console.log("[init-neurapay] request received", {
      method: request.method,
      url: request.url,
      authProvided: !!request.headers.get("Authorization"),
      testMode,
      env: {
        keys: env ? Object.keys(env).sort() : null,
        supabase: !!supabaseUrl,
        supabaseServiceKey: !!serviceKey,
        neurapay_public: !!publicKey,
        neurapay_secret: !!secretKey,
        neurapay_base: !!baseUrl,
        siteUrl: !!siteUrl,
      },
      rawServiceKey: env?.SUPABASE_SERVICE_ROLE_KEY ? String(env.SUPABASE_SERVICE_ROLE_KEY).slice(0,8) : null,
      rawNeuraPaySecret: env?.NEURAPAY_SECRET_KEY ? String(env.NEURAPAY_SECRET_KEY).slice(0,8) : null,
    });

    if (!testMode && (!supabaseUrl || !serviceKey)) return json({ error: "Server not configured" }, 503);
    if (!testMode && (!secretKey || !baseUrl)) {
      return json({ error: "NeuraPay credentials are not configured. Add NEURAPAY_SECRET_KEY and NEURAPAY_BASE_URL." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const { amount, userId, reference } = body;
    console.log("[init-neurapay] payload received", {
      amount: Number(amount),
      userId,
      reference: reference?.slice(-16),
    });
    if (!amount || !userId || !reference)
      return json({ error: "amount, userId and reference are required" }, 400);

    let user = null;
    if (testMode) {
      user = { id: userId, email: `${String(userId).split("-")[0] || "user"}@example.local`, phone: null };
    } else {
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
      if (!user) return json({ error: "Unauthorized" }, 401);
    }
    if (userId !== user.id) return json({ error: "Forbidden" }, 403);

  let existingIntent = null;
  if (!testMode) {
    const existingRes = await sbFetch(
      supabaseUrl,
      serviceKey,
      `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(userId)}&provider=eq.neurapay&limit=1`,
    );
    const existing = existingRes.ok ? await existingRes.json().catch(() => []) : [];
    existingIntent = Array.isArray(existing) ? existing[0] : null;
  } else {
    console.log("[init-neurapay] skipping existing intent lookup in test mode");
  }

  if (existingIntent?.status === "success") {
    return json({
      success: true,
      amount: Number(existingIntent.amount ?? amount),
      reference,
      alreadyCredited: true,
    });
  }

  const initPayload = {
    amount: Number(amount),
    reference,
    currency: "NGN",
    customerName: user.email?.split("@")[0] || "Customer",
    customerEmail: user.email || "",
    description: `Wallet funding via NeuraPay (${reference})`,
    callbackUrl: `${siteUrl}/wallet?ref=${reference}&userId=${userId}&provider=neurapay`,
  };

  let initRes;
  let initBody;
  let initJson = null;
  try {
    if (testMode) {
      console.log("[init-neurapay] using local test-mode response", { reference, amount: Number(amount) });
      initJson = {
        success: true,
        message: "Test-mode NeuraPay initialization succeeded",
        data: {
          accountNumber: `NP${String(reference).slice(-8).toUpperCase()}`,
          bankName: "NeuraPay Test Bank",
          reference,
        },
      };
      initRes = { ok: true, status: 200 };
      initBody = JSON.stringify(initJson);
    } else {
      console.log("[init-neurapay] sending NeuraPay request", {
        url: `${baseUrl}/v1/transactions/init`,
        method: "POST",
        authHeader: secretKey ? "Bearer [REDACTED]" : "missing",
        payload: initPayload,
      });
      initRes = await fetch(`${baseUrl}/v1/transactions/init`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(initPayload),
        signal: AbortSignal.timeout(10000),
      });
      initBody = await initRes.text();
      console.log("[init-neurapay] response status", initRes.status);
      console.log("[init-neurapay] response body", initBody);
      try {
        initJson = initBody ? JSON.parse(initBody) : null;
      } catch (err) {
        console.error("[init-neurapay] invalid JSON", err, initBody);
        return json({ error: `NeuraPay returned invalid JSON: ${err instanceof Error ? err.message : String(err)}` }, 502);
      }
    }
  } catch (err) {
    console.error("[init-neurapay] request error", err);
    return json({ error: `NeuraPay initialization request failed: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  if (!initRes.ok || !isNeuraPaySuccess(initJson)) {
    const errorMessage = extractNeuraPayErrorMessage(initJson, initRes.status);
    console.error("[init-neurapay] request failed", { errorMessage, initJson });
    return json({ error: errorMessage }, 502);
  }

  const payload = {
    user_id: userId,
    provider: "neurapay",
    reference,
    amount: Number(amount),
    currency: "NGN",
    status: "pending",
    description: "Wallet funding via NeuraPay",
    raw: initJson,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!testMode) {
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
  } else {
    console.log("[init-neurapay] skipping payment_intents save in test mode");
  }

  const accountNumber = extractNeuraPayValue(initJson, ["accountNumber", "account_number", "virtualAccountNumber", "virtual_account_number", "accountNo", "account_no"]) || `NP${reference.slice(-8).toUpperCase()}`;
  const bankName = extractNeuraPayValue(initJson, ["bankName", "bank_name", "bank", "accountBank"]) || "NeuraPay Virtual Account";

  return json({
    success: true,
    reference,
    amount: Number(amount),
    accountNumber,
    bankName,
    instructions: "Transfer the amount to the virtual account below, then verify the payment.",
    publicKey,
  });
  } catch (err) {
    console.error("[init-neurapay] unhandled error", err);
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}

async function getUser(supabaseUrl, serviceKey, token) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
    });
    return res.ok ? res.json() : null;
  } catch (err) {
    console.error("[init-neurapay] getUser failed", {
      error: err instanceof Error ? err.message : String(err),
      supabaseUrl,
    });
    return null;
  }
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

function readEnvValue(env, key) {
  const value = env?.[key];
  if (value !== undefined && value !== null && value !== "") return value;
  const fallback = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return fallback !== undefined && fallback !== null ? fallback : "";
}

function isNeuraPaySuccess(payload) {
  if (!payload) return false;
  if (payload.success === true) return true;
  if (payload.status === "success") return true;
  if (payload.status === "paid") return true;
  if (payload.data?.success === true) return true;
  if (payload.data?.status === "success") return true;
  return false;
}

function isNeuraPayTestMode(env) {
  const raw = [
    readEnvValue(env, "NEURAPAY_SECRET_KEY"),
    readEnvValue(env, "NEURAPAY_PUBLIC_KEY"),
    readEnvValue(env, "NEURAPAY_BASE_URL"),
    readEnvValue(env, "NEURAPAY_TEST_MODE"),
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
  return raw.includes("test") || raw.includes("demo") || raw.includes("placeholder") || raw.includes("fake");
}

function extractNeuraPayErrorMessage(payload, status) {
  const message = extractNeuraPayValue(payload, ["message", "error", "detail", "errorMessage"]);
  if (message) return String(message);
  return `NeuraPay initialization failed with status ${status}`;
}

function extractNeuraPayValue(payload, keys) {
  const visit = (node, path) => {
    if (!node || typeof node !== "object") return undefined;
    for (const key of path) {
      const value = node[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    for (const key of Object.keys(node)) {
      if (typeof node[key] === "object" && node[key] !== null) {
        const found = visit(node[key], path);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return visit(payload, keys);
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
