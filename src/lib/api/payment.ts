import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

async function getToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function callApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await getToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let errorMessage = `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
    try {
      const data = JSON.parse(text) as {
        error?: string;
        stage?: string;
        diagnostics?: Record<string, unknown>;
      };
      if (data?.error) errorMessage = data.error;
      if (data?.stage || data?.diagnostics) {
        // Secret-free server diagnostics, surfaced for debugging.
        console.error(`[payment] ${path} failed at stage="${data.stage}"`, data.diagnostics);
      }
    } catch {
      // Non-JSON body (e.g. Cloudflare's HTML 502 page) — never show raw
      // markup to the user, just keep the generic status-based message.
      if (text && !text.trim().startsWith("<")) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  return res.json() as Promise<T>;
}

export type NeuraPayInitResult = {
  success: boolean;
  reference: string;
  amount: number;
  alreadyCredited?: boolean;
  providerReference?: string | null;
  paymentUrl?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  instructions?: string;
};

export type NeuraPayVerifyResult = {
  success: boolean;
  status: "successful" | "pending" | "failed" | "cancelled" | string;
  amount?: number;
  alreadyCredited?: boolean;
  error?: string;
};

export async function initNeuraPayDeposit(data: {
  amount: number;
  userId: string;
  reference: string;
}) {
  return callApi<NeuraPayInitResult>("/api/payment/init-neurapay", data);
}

export async function verifyNeuraPayDeposit(data: { reference: string; userId: string }) {
  return callApi<NeuraPayVerifyResult>("/api/payment/verify-neurapay", data);
}

export type NeuraPayReconcileResult = {
  success: boolean;
  pending: number;
  creditedCount: number;
  creditedAmount: number;
  results: Array<{ reference: string; status: string }>;
};

/** Confirms every pending NeuraPay intent server-side and credits the paid ones. */
export async function reconcileNeuraPayDeposits() {
  return callApi<NeuraPayReconcileResult>("/api/payment/reconcile-neurapay", {});
}

export async function adminCreditWalletFn(data: {
  targetUserId: string;
  amount: number;
  description: string;
}) {
  return callApi<{ success: boolean }>("/api/payment/admin-credit", data);
}

export async function adminDebitWalletFn(data: {
  targetUserId: string;
  amount: number;
  description: string;
}) {
  return callApi<{ success: boolean; newBalance: number }>("/api/payment/admin-debit", data);
}
