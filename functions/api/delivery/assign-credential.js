// Cloudflare Pages Function — POST /api/delivery/assign-credential
// Finds the credential already assigned by purchase_with_wallet (or assigns a new one),
// stores its content directly in order_items.delivered_payload, and preserves the
// credential record (it will be marked with order_id/delivered_at by the RPC).

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);

  const user = await getUser(supabaseUrl, serviceKey, token);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await request.json();
  const { orderId, productId } = body;
  if (!orderId || !productId) return json({ error: "orderId and productId are required" }, 400);

  // Verify order ownership
  const orderRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/orders?id=eq.${orderId}&select=id,user_id,status&limit=1`);
  const orders = await orderRes.json();
  if (!orders?.length) return json({ error: "Order not found" }, 404);
  if (orders[0].user_id !== user.id) return json({ error: "Forbidden" }, 403);

  // Step 1: Already delivered? Return content directly.
  const itemRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/order_items?order_id=eq.${orderId}&product_id=eq.${productId}&select=delivered_payload&limit=1`);
  const items = await itemRes.json();
  if (items?.[0]?.delivered_payload) {
    return json({ assigned: true, content: items[0].delivered_payload, label: null });
  }

  // Step 2: Credential already assigned to this order by purchase_with_wallet?
  const credRes = await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/product_credentials?order_id=eq.${orderId}&product_id=eq.${productId}&select=id,content,label&limit=1`);
  const existingCreds = await credRes.json();

  let credId = null, credContent = null, credLabel = null;

  if (existingCreds?.length) {
    credId      = existingCreds[0].id;
    credContent = existingCreds[0].content;
    credLabel   = existingCreds[0].label;
  } else {
    // Step 3: Call the assign RPC
    const rpcRes = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/rpc/assign_credential_to_order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _order_id: orderId, _product_id: productId }),
    });
    if (!rpcRes.ok) {
      const txt = await rpcRes.text();
      return json({ error: `RPC failed: ${txt}` }, 500);
    }
    credId = await rpcRes.json();
    if (!credId) return json({ assigned: false, content: null, label: null });

    const nc = await sbFetch(supabaseUrl, serviceKey,
      `/rest/v1/product_credentials?id=eq.${credId}&select=content,label&limit=1`);
    const ncData = await nc.json();
    credContent = ncData?.[0]?.content ?? null;
    credLabel   = ncData?.[0]?.label ?? null;
  }

  if (!credContent) return json({ assigned: false, content: null, label: null });

  // Step 4: Store content in delivered_payload
  await sbFetch(supabaseUrl, serviceKey,
    `/rest/v1/order_items?order_id=eq.${orderId}&product_id=eq.${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delivered_payload: credContent }),
  });

  // Step 5: Preserve credential record (it was updated by assign_credential_to_order).
  // We intentionally do NOT delete the product_credentials row to keep an audit trail.

  return json({ assigned: true, content: credContent, label: credLabel });
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
