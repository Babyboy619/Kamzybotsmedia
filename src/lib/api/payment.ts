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
      const data = JSON.parse(text) as { error?: string };
      if (data?.error) errorMessage = data.error;
    } catch {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  return res.json() as Promise<T>;
}

export async function initNeuraPayDeposit(data: {
  amount: number;
  userId: string;
  reference: string;
}) {
  return callApi<{
    success: boolean;
    amount: number;
    reference: string;
    accountNumber: string;
    bankName: string;
    instructions: string;
  }>("/api/payment/init-neurapay", data);
}

export async function verifyNeuraPayDeposit(data: { reference: string; userId: string }) {
  return callApi<{ success: boolean; amount: number; alreadyCredited: boolean }>(
    "/api/payment/verify-neurapay",
    data,
  );
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
