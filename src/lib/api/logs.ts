import { supabase } from "@/integrations/supabase/client";

export type ExternalLogProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  stock: number;
  description: string | null;
  image_url: string | null;
  currency: string;
  source: string;
};

export async function listExternalLogs(): Promise<ExternalLogProduct[]> {
  const res = await fetch("/api/logs", { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({ logs: [] }))) as { logs?: ExternalLogProduct[] };
  return data.logs ?? [];
}

export async function getExternalLog(slug: string): Promise<ExternalLogProduct | null> {
  const res = await fetch(`/api/logs/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { log?: ExternalLogProduct | null } | null;
  return data?.log ?? null;
}

export async function purchaseExternalLog(payload: { slug: string; quantity: number }) {
  const token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  const res = await fetch(`/api/logs/${encodeURIComponent(payload.slug)}/purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ quantity: payload.quantity }),
  });

  const data = (await res.json().catch(() => ({ error: "Purchase failed" }))) as {
    error?: string;
    order?: unknown;
    delivery?: unknown;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Purchase failed");
  }
  return data;
}
