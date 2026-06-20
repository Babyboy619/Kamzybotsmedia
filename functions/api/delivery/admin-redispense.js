// Cloudflare Pages Function — POST /api/delivery/admin-redispense
// Admin-only: finds or assigns a credential, stores content in order_items.delivered_payload,
// and preserves the credential record (the RPC marks it with order_id/delivered_at).

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);

  const user = await getUser(supabaseUrl, serviceKey, token);
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Check admin role
  const rolesRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/user_roles?user_id=eq.${user.id}&role=eq.admin&limit=1`);
  const roles = await rolesRes.json();
  if (!roles?.length) return json({ error: "Forbidden: admin access required" }, 403);

  const body = await request.json();
  const { orderId, productId } = body;
  if (!orderId || !productId) return json({ error: "orderId and productId are required" }, 400);

  // Already delivered?
  const itemRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/order_items?order_id=eq.${orderId}&product_id=eq.${productId}&select=delivered_payload&limit=1`);
  const items = await itemRes.json();
  if (items?.[0]?.delivered_payload) {
    return json({ assigned: true, content: items[0].delivered_payload });
  }

  // Credential already assigned but payload not set?
  const credRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/product_credentials?order_id=eq.${orderId}&product_id=eq.${productId}&select=id,content&limit=1`);
  const existingCreds = await credRes.json();

  let credId = null, credContent = null;

  if (existingCreds?.length) {
    credId      = existingCreds[0].id;
    credContent = existingCreds[0].content;
  } else {
    const rpcRes = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/rpc/assign_credential_to_order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _order_id: orderId, _product_id: productId }),
    });
    if (!rpcRes.ok) return json({ assigned: false, message: "RPC failed" }, 500);
    credId = await rpcRes.json();
    if (!credId) return json({ assigned: false, message: "No available credentials for this product" });

    const nc = await sbFetch(supabaseUrl, serviceKey,
      `/rest/v1/product_credentials?id=eq.${credId}&select=content&limit=1`);
    const ncData = await nc.json();
    credContent = ncData?.[0]?.content ?? null;
  }

  if (!credContent) return json({ assigned: false, message: "Credential content not found" });

  await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/order_items?order_id=eq.${orderId}&product_id=eq.${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delivered_payload: credContent }),
  });

  // Preserve credential record (do NOT delete) — the credential is kept for auditing.

  return json({ assigned: true, content: credContent });
}

async function getUser(supabaseUrl, serviceKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!res.ok) return null;
  return res.json();
}

function sbFetch(supabaseUrl, serviceKey, path, extra = {}) {
  const { headers: extraHeaders = {}, ...rest } = extra;
  return fetch(`${supabaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, ...extraHeaders },
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
