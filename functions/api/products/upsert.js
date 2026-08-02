// Cloudflare Pages Function — POST /api/products/upsert
// Admin-only: create or update a product bypassing RLS via service role.

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server not configured" }, 503);

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const user = await getUser(supabaseUrl, serviceKey, auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);

  const rolesRes = await sbFetch(
    supabaseUrl,
    serviceKey,
    `/rest/v1/user_roles?user_id=eq.${user.id}&role=eq.admin&limit=1`,
  );
  const roles = await rolesRes.json();
  if (!roles?.length) return json({ error: "Forbidden" }, 403);

  const body = await request.json();
  const { id, ...payload } = body;
  const now = new Date().toISOString();

  if (id) {
    const res = await sbFetch(supabaseUrl, serviceKey, `/rest/v1/products?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ ...payload, updated_at: now }),
    });
    if (!res.ok) return json({ error: await res.text() }, 400);
    const data = await res.json();
    return json({ product: Array.isArray(data) ? data[0] : data });
  }

  const res = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, created_at: now, updated_at: now }),
  });
  if (!res.ok) return json({ error: await res.text() }, 400);
  const data = await res.json();
  return json({ product: Array.isArray(data) ? data[0] : data });
}

async function getUser(supabaseUrl, serviceKey, token) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!res.ok) return null;
  return res.json();
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
