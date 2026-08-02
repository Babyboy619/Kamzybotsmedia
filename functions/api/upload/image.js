// Cloudflare Pages Function — POST /api/upload/image
// Accepts multipart/form-data with a "file" field.
// Auto-creates the "product-images" Supabase Storage bucket on first use,
// then uploads and returns the public URL.

const DEFAULT_BUCKET = "product-images";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseResponseBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function ensureBucket(supabaseUrl, serviceKey, bucket) {
  const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: bucket, name: bucket, public: true }),
  });

  if (res.ok || res.status === 409) {
    return;
  }

  const body = await parseResponseBody(res);
  const message = body.error || body.message || body.details || JSON.stringify(body);
  throw new Error(`Bucket creation failed: ${message}`);
}

export async function onRequestPost({ request, env }) {
  const rawSupabaseUrl = env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, "");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Storage not configured on server" }, 503);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Invalid multipart request" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") return json({ error: "No file provided" }, 400);
  if (!file.type.startsWith("image/")) return json({ error: "Only image files are allowed" }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: "Image must be 5 MB or smaller" }, 400);

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  const bytes = await file.arrayBuffer();
  await ensureBucket(supabaseUrl, serviceKey, bucket);

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(fileName)}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const body = await parseResponseBody(uploadRes);
    const message = body.error || body.message || body.details || body.text || "Upload failed";
    return json(
      {
        error: `Upload failed: ${message}`,
        status: uploadRes.status,
        supabase: body,
        uploadUrl,
      },
      uploadRes.status,
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(fileName)}`;
  return json({ url: publicUrl });
}
