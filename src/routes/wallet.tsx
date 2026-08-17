import NeuraPayTopup from "@/components/NeuraPayTopup";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Loader2,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reconcileNeuraPayDeposits } from "@/lib/api/payment";

type WalletRow = { id: string; balance: number; currency: string; updated_at: string };
type Tx = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  status: string;
  provider: string | null;
  description: string | null;
  created_at: string;
};

async function getFreshToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const RETRY_DELAY_MS = 2000;
const MAX_ATTEMPTS = 3;

/**
 * Ensures the user has a wallet row.
 * Strategy (each attempt):
 *   1. SELECT existing wallet (idempotency — never duplicate-create)
 *   2. POST /api/wallet/ensure  (CF Pages Function, uses service role)
 *   3. ensure_user_wallet() RPC (SECURITY DEFINER fallback)
 *   4. Direct INSERT via anon client (wallets_self_insert policy)
 *
 * Returns { wallet, error } after up to MAX_ATTEMPTS tries.
 */
async function ensureWalletWithRetry(
  userId: string,
): Promise<{ wallet: WalletRow | null; error: string | null }> {
  let lastError = "Wallet unavailable — please retry";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[Wallet] ensureWallet attempt ${attempt}/${MAX_ATTEMPTS} for user ${userId}`);

    // ── Step 1: idempotency — check if wallet already exists ─────────────
    try {
      const { data: existing, error: selErr } = await supabase
        .from("wallets")
        .select("id,balance,currency,updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (selErr) {
        console.warn(
          `[Wallet] attempt ${attempt} SELECT error:`,
          selErr.message,
          `(code ${selErr.code})`,
        );
        lastError = `DB error: ${selErr.message} (${selErr.code})`;
      } else if (existing) {
        console.log(`[Wallet] attempt ${attempt} wallet found via SELECT`);
        return { wallet: existing as WalletRow, error: null };
      }
    } catch (e) {
      console.warn(`[Wallet] attempt ${attempt} SELECT threw:`, e);
    }

    // ── Step 2: server-side CF Pages Function ────────────────────────────
    const token = await getFreshToken();
    if (token) {
      try {
        const res = await fetch("/api/wallet/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId }),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) {
          const data = (await res.json()) as { wallet: WalletRow };
          console.log(`[Wallet] attempt ${attempt} wallet ensured via /api/wallet/ensure`);
          return { wallet: data.wallet, error: null };
        }

        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        const reason = errData.error ?? `HTTP ${res.status}`;
        console.warn(`[Wallet] attempt ${attempt} /api/wallet/ensure failed: ${reason}`);
        lastError = `Server error: ${reason}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[Wallet] attempt ${attempt} /api/wallet/ensure threw: ${msg}`);
        lastError = `Network error: ${msg}`;
      }
    } else {
      console.warn(`[Wallet] attempt ${attempt} no auth token — skipping server call`);
      lastError = "Not authenticated — please sign in again";
    }

    // ── Step 3: SECURITY DEFINER RPC ─────────────────────────────────────
    try {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("ensure_user_wallet" as never);
      if (rpcErr) {
        console.warn(
          `[Wallet] attempt ${attempt} ensure_user_wallet RPC error:`,
          rpcErr.message,
          `(${rpcErr.code})`,
        );
        lastError = `RPC error: ${rpcErr.message} (${rpcErr.code})`;
      } else {
        const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
        if (row) {
          console.log(`[Wallet] attempt ${attempt} wallet ensured via RPC`);
          return { wallet: row as WalletRow, error: null };
        }
      }
    } catch (e) {
      console.warn(`[Wallet] attempt ${attempt} RPC threw:`, e);
    }

    // ── Step 4: direct INSERT (wallets_self_insert policy) ───────────────
    try {
      const { data: created, error: insErr } = await supabase
        .from("wallets")
        .insert({ user_id: userId, balance: 0, currency: "NGN" })
        .select("id,balance,currency,updated_at")
        .maybeSingle();

      if (insErr) {
        console.warn(
          `[Wallet] attempt ${attempt} INSERT error:`,
          insErr.message,
          `(${insErr.code})`,
        );
        lastError = `Insert error: ${insErr.message} (${insErr.code})`;
      } else if (created) {
        console.log(`[Wallet] attempt ${attempt} wallet created via direct INSERT`);
        return { wallet: created as WalletRow, error: null };
      }
    } catch (e) {
      console.warn(`[Wallet] attempt ${attempt} INSERT threw:`, e);
    }

    // Pause before next attempt
    if (attempt < MAX_ATTEMPTS) {
      console.log(`[Wallet] retrying in ${RETRY_DELAY_MS}ms…`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  console.error(`[Wallet] all ${MAX_ATTEMPTS} attempts failed. Last error: ${lastError}`);
  return { wallet: null, error: lastError };
}

export default function WalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/wallet");
  }, [user, loading, navigate]);

  const fetchData = async () => {
    if (!user) return;
    setDataLoading(true);
    setWalletError(null);

    const [{ wallet: walletRow, error: walletErr }, txResult] = await Promise.all([
      ensureWalletWithRetry(user.id),
      (async (): Promise<Tx[]> => {
        if (!isSupabaseConfigured()) return [];
        try {
          const { data, error } = await supabase
            .from("wallet_transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          if (error) console.warn("[Wallet] tx fetch error:", error.message);
          return (data as Tx[]) ?? [];
        } catch {
          return [];
        }
      })(),
    ]);

    setWallet(walletRow);
    setTransactions(txResult);

    if (!walletRow) {
      setWalletError(walletErr ?? "Unable to load wallet — please try again");
    }

    setDataLoading(false);
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // Return-from-NeuraPay: verify the reference in the URL (no userId needed —
  // the server scopes the lookup to the authenticated caller), then clean the
  // query string via the router instead of reloading the page.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || !user) return;

    const verifyPayment = async () => {
      const tid = toast.loading("Verifying your payment…");
      const token = await getFreshToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const res = await fetch(`/api/payment/verify-neurapay`, {
          method: "POST",
          headers,
          body: JSON.stringify({ reference: ref, userId: user.id }),
        });
        const payload = await res.json().catch(() => ({}));
        toast.dismiss(tid);
        if (!res.ok) {
          toast.error(payload.error ?? `Verification failed (${res.status})`);
        } else if (payload.success) {
          try {
            localStorage.removeItem("neurapay:pending");
          } catch {
            /* storage unavailable */
          }
          if (payload.alreadyCredited) {
            toast.info("Payment already credited to your wallet.");
          } else {
            toast.success(
              `₦${Number(payload.amount ?? 0).toLocaleString("en-NG")} added to your wallet!`,
            );
          }
        } else {
          toast.info(payload.error ?? "Payment is still pending. We'll credit it automatically.");
        }
        fetchData();
      } catch (err) {
        toast.dismiss(tid);
        toast.error(err instanceof Error ? err.message : "Verification failed — contact support");
      } finally {
        navigate("/wallet", { replace: true });
      }
    };

    void verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  // Safety net: sweep any pending NeuraPay intents whenever the wallet loads,
  // so payments completed while the user was away still land.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await reconcileNeuraPayDeposits();
        if (cancelled || !result?.creditedCount) return;
        toast.success(
          `₦${Number(result.creditedAmount ?? 0).toLocaleString("en-NG")} from ${result.creditedCount} completed payment${result.creditedCount > 1 ? "s" : ""} added to your wallet.`,
        );
        try {
          localStorage.removeItem("neurapay:pending");
        } catch {
          /* storage unavailable */
        }
        fetchData();
      } catch (e) {
        console.warn("[Wallet] reconcile skipped:", e instanceof Error ? e.message : e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const funded = searchParams.get("funded");
    if (funded === "1") toast.success("Payment submitted! Your wallet will be credited shortly.");
  }, [searchParams]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel("wallet-rt")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
          () => fetchData(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchData(),
        )
        .subscribe();
    } catch {
      /* realtime optional */
    }
    return () => {
      if (ch) supabase.removeChannel(ch).catch(() => {});
    };
  }, [user]);

  if (loading || !user)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
      </div>
    );

  return (
    <div className="min-h-[calc(100vh-200px)] bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-navy">My Wallet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your balance and fund your account
          </p>
        </div>

        {!isSupabaseConfigured() && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Configuration Required</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable wallet features.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {walletError && !dataLoading && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">Wallet could not be loaded</p>
                <p className="text-xs text-red-600 mt-0.5 font-mono break-all">{walletError}</p>
                <p className="text-xs text-red-500 mt-1">
                  Open browser DevTools → Console to see full diagnostics.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchData}
                className="shrink-0 text-xs border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
            <p className="text-xs text-muted-foreground">Setting up your wallet…</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-brand-navy to-brand-navy/90 text-white rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 80% 20%, #f97316 0%, transparent 60%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-5 h-5 text-brand-orange" />
                  <span className="text-white/70 text-sm">Available Balance</span>
                  <button
                    onClick={fetchData}
                    className="ml-auto text-white/50 hover:text-white transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-3xl sm:text-4xl font-bold mb-1">
                  ₦{(wallet?.balance ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-white/40 text-xs">
                  {wallet?.currency ?? "NGN"} · Updated{" "}
                  {wallet?.updated_at ? new Date(wallet.updated_at).toLocaleTimeString() : "—"}
                </div>
              </div>
            </div>

            <Tabs defaultValue="fund" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="fund">Fund Wallet</TabsTrigger>
                <TabsTrigger value="history">Transaction History</TabsTrigger>
              </TabsList>

              <TabsContent value="fund">
                <FundWallet user={user} wallet={wallet} onFunded={fetchData} />
              </TabsContent>

              <TabsContent value="history">
                <TransactionList transactions={transactions} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function FundWallet({
  user,
  wallet,
  onFunded,
}: {
  user: import("@supabase/supabase-js").User;
  wallet: WalletRow | null;
  onFunded: () => void;
}) {
  return (
    <div className="max-w-2xl">
      <NeuraPayTopup userId={user.id} onCompleted={onFunded} />
    </div>
  );
}

function TransactionList({ transactions }: { transactions: Tx[] }) {
  if (transactions.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 mt-4" />
          <p className="text-muted-foreground text-sm">
            No transactions yet. Fund your wallet to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <Card key={tx.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-green-50" : "bg-red-50"}`}
                >
                  {tx.type === "credit" ? (
                    <ArrowDownCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-brand-navy">
                    {tx.description ?? (tx.type === "credit" ? "Wallet Credit" : "Purchase")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tx.provider && <span className="capitalize mr-1.5">{tx.provider}</span>}·{" "}
                    {new Date(tx.created_at).toLocaleString("en-NG", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={`font-semibold text-sm ${tx.type === "credit" ? "text-green-600" : "text-red-500"}`}
                >
                  {tx.type === "credit" ? "+" : "-"}₦{Number(tx.amount).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Bal: ₦{Number(tx.balance_after).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
