// Cloudflare Pages Function — POST /api/webhooks/neurapay
// NeuraPay webhook handler. Verifies signature, confirms payment with NeuraPay,
// credits the wallet, and updates the corresponding payment_intent.

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secretKey = env.NEURAPAY_WEBHOOK_SECRET || "";
  const baseUrl = env.NEURAPAY_BASE_URL || "https://neurapay.com.ng/api/v1";

  if (!supabaseUrl || !serviceKey || !secretKey) {
    return json({ error: "Server not configured" }, 503);
  }

  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-neurapay-signature") ||
    request.headers.get("x-signature") ||
    request.headers.get("signature") ||
    "";

  if (!signatureHeader) {
    console.error("[neurapay webhook] missing signature header");
    return json({ error: "Missing signature header" }, 401);
  }

  const validSignature = await verifyNeuraPaySignature(rawBody, signatureHeader, secretKey);
  if (!validSignature) {
    console.error("[neurapay webhook] invalid signature", signatureHeader);
    return json({ error: "Invalid signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[neurapay webhook] invalid JSON", err);
    return json({ error: "Bad JSON" }, 400);
  }

  const reference = String(
    extractNeuraPayValue(payload, [
      "reference",
      "data.reference",
      "transaction.reference",
      "payment_reference",
      "paymentReference",
    ]) ?? "",
  ).trim();

  if (!reference) {
    console.error("[neurapay webhook] missing reference", payload);
    return json({ error: "Missing reference" }, 400);
  }

  const isPaid = String(
    extractNeuraPayValue(payload, [
      "status",
      "payment_status",
      "data.status",
      "transaction.status",
      "paymentStatus",
    ]) ?? ""
  ).toLowerCase();

  const statusAccepted = ["success", "paid", "completed", "confirmed"].includes(isPaid);
  if (!statusAccepted) {
    console.log(`[neurapay webhook] ignoring status: ${isPaid} for ${reference}`);
    return json({ received: true, status: isPaid });
  }

  const intentRes = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}&provider=eq.neurapay&limit=1`,
  );
  const intents = intentRes.ok ? await intentRes.json().catch(() => []) : [];
  const intent = Array.isArray(intents) ? intents[0] : null;

  if (intent?.status === "success") {
    return json({ received: true, alreadyCredited: true });
  }

  let amount = Number(
    extractNeuraPayValue(payload, [
      "amount",
      "data.amount",
      "transaction.amount",
      "payment_amount",
      "amountPaid",
      "amount_paid",
      "price",
    ]) ?? intent?.amount ?? 0,
  );

  if (amount <= 0 && intent?.amount) {
    const maybe = Number(intent.amount);
    if (maybe > 0) {
      amount = maybe;
    }
  }

  if (amount <= 0) {
    console.error("[neurapay webhook] invalid amount", amount, payload);
    return json({ error: "Invalid amount" }, 400);
  }

  const verifyUrl = `${baseUrl}/transactions/verify`;
  let verifyRes;
  let verifyBody;
  let verifyJson = null;

  try {
    verifyRes = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reference, amount }),
      signal: AbortSignal.timeout(10000),
    });
    verifyBody = await verifyRes.text();
    verifyJson = verifyBody ? JSON.parse(verifyBody) : null;
  } catch (err) {
    console.error("[neurapay webhook] verification request failed", err);
    return json({ error: "NeuraPay verification request failed" }, 502);
  }

  if (!verifyRes?.ok || !isNeuraPaySuccess(verifyJson)) {
    const errorMessage = extractNeuraPayErrorMessage(verifyJson, verifyRes?.status ?? 0);
    console.error("[neurapay webhook] verification failed", {
      reference,
      verifyStatus: verifyRes?.status,
      errorMessage,
      verifyJson,
    });
    return json({ error: errorMessage }, 400);
  }

  const targetUserId = intent?.user_id;
  if (!targetUserId) {
    console.error("[neurapay webhook] missing user_id in payment_intent", reference);
    return json({ error: "Cannot resolve user" }, 400);
  }

  await ensureWallet(supabaseUrl, serviceKey, targetUserId);

  const rpcRes = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/rpc/credit_wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _user_id: targetUserId,
      _amount: amount,
      _provider: "neurapay",
      _reference: reference,
      _description: "Wallet funded via NeuraPay",
    }),
  });

  if (!rpcRes.ok) {
    const errText = await rpcRes.text().catch(() => "");
    console.error("[neurapay webhook] credit_wallet failed", errText);
    return json({ error: `Failed to credit wallet: ${errText}` }, 500);
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
        user_id: targetUserId,
        provider: "neurapay",
        reference,
        amount,
        currency: "NGN",
        status: "success",
        raw: payload,
      }),
    });
  }

  console.log(`[neurapay webhook] credited ₦${amount} for ${targetUserId} (${reference})`);
  return json({ received: true, credited: true });
}

async function verifyNeuraPaySignature(body, signature, secret) {
  const normalized = String(signature).trim().toLowerCase();
  const rawSig = normalized.startsWith("sha256=") ? normalized.slice(7) : normalized;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return computed === rawSig;
  } catch (err) {
    console.error("[neurapay webhook] signature verification error", err);
    return false;
  }
}

async function ensureWallet(supabaseUrl, serviceKey, userId) {
  const res = await sbFetch(supabaseUrl, serviceKey, `/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
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

function isNeuraPaySuccess(payload) {
  if (!payload) return false;
  if (payload.success === true) return true;
  if (payload.status === "success") return true;
  if (payload.status === "paid") return true;
  if (payload.data?.success === true) return true;
  if (payload.data?.status === "success") return true;
  return false;
}

function extractNeuraPayErrorMessage(payload, status) {
  const message = extractNeuraPayValue(payload, ["message", "error", "detail", "errorMessage"]);
  if (message) return String(message);
  return `NeuraPay request failed with status ${status}`;
}

function extractNeuraPayValue(payload, keys) {
  const visit = (node, path) => {
    if (!node || typeof node !== "object") return undefined;
    for (const key of path) {
      const value = node[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === "object") {
        const found = visit(child, path);
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-neurapay-signature, x-signature, signature",
    },
  });
}
