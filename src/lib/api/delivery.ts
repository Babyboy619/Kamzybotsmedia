import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

type DeliveryResult = { assigned: boolean; content: string | null; label: string | null };

async function getToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Fallback: call the user_claim_credential SECURITY DEFINER function directly.
// Only works if the migration 001_user_credential_claim.sql has been applied.
// Returns assigned:false gracefully if the function doesn't exist yet.
async function claimViaRpc(orderId: string, productId: string): Promise<DeliveryResult> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, string>,
      ) => Promise<{
        data: DeliveryResult | null;
        error: { message: string; code?: string } | null;
      }>
    )("user_claim_credential", { _order_id: orderId, _product_id: productId });
    // PGRST202 = function not found — migration not applied yet, degrade gracefully
    if (error) {
      if (error.code === "PGRST202" || error.message?.includes("user_claim_credential")) {
        return { assigned: false, content: null, label: null };
      }
      throw new Error(error.message);
    }
    return data ?? { assigned: false, content: null, label: null };
  } catch (e) {
    console.warn("[delivery] RPC fallback failed:", e);
    return { assigned: false, content: null, label: null };
  }
}

export async function assignCredentialToOrder(data: {
  orderId: string;
  productId: string;
}): Promise<DeliveryResult> {
  const token = await getToken();

  // 1. Try the Express server (needs SUPABASE_SERVICE_ROLE_KEY — works in production)
  try {
    const res = await fetch("/api/delivery/assign-credential", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(12_000),
    });

    if (res.ok) return res.json() as Promise<DeliveryResult>;

    // 503 = server has no service_role key → fall through to RPC
    if (res.status !== 503) {
      const json = await res.json().catch(() => ({ error: "Delivery failed" }));
      throw new Error((json as { error?: string }).error ?? "Delivery failed");
    }
  } catch (e) {
    // Network error or timeout — fall through to RPC
    if (!(e instanceof TypeError) && !(e instanceof DOMException)) throw e;
  }

  // 2. Fallback: call user_claim_credential RPC with user's JWT (no service_role needed)
  if (isSupabaseConfigured()) {
    return claimViaRpc(data.orderId, data.productId);
  }

  return { assigned: false, content: null, label: null };
}
