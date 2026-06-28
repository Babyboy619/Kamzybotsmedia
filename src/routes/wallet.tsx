import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initOpayPayment, verifyOpayPayment, createNowPaymentsInvoice, checkNowPaymentsStatus, initMonnifyPayment, verifyMonnifyPayment } from "@/lib/api/payment";
import { useAuth } from "@/hooks/use-auth";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Loader2, Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, CreditCard, Bitcoin, RefreshCw } from "lucide-react";

type WalletRow = { id: string; balance: number; currency: string; updated_at: string };
type Tx = { id: string; type: "credit" | "debit"; amount: number; balance_after: number; status: string; provider: string | null; description: string | null; created_at: string };

async function getFreshToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function Wallet() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate("/auth?redirect=/wallet"); }, [user, loading, navigate]);

  const fetchData = async () => {
    if (!user) return;
    setDataLoading(true);
    setWalletError(null);
    try {
      const { data: w, error: wErr } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
      if (wErr) throw wErr;
      setWallet(w as WalletRow | null);

      const { data: txs, error: txErr } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (txErr) throw txErr;
      setTransactions((txs as Tx[]) ?? []);
    } catch (e: unknown) {
      setWalletError(e instanceof Error ? e.message : "Failed to load wallet data");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  // Realtime updates for wallet + transactions
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Handle payment callback redirect: /wallet?ref=REF&userId=UID&provider=opay|monnify
  useEffect(() => {
    const ref      = searchParams.get("ref");
    const userId   = searchParams.get("userId");
    const provider = searchParams.get("provider");
    const cancelled = searchParams.get("cancelled");
    if (!ref || !userId || !user) return;
    if (cancelled === "1") { toast.info("Payment cancelled"); return; }

    const tid = toast.loading("Verifying your payment…");
    const verify = provider === "monnify"
      ? verifyMonnifyPayment({ reference: ref, userId })
      : verifyOpayPayment({ reference: ref, userId });

    verify
      .then((result) => {
        toast.dismiss(tid);
        if (result.alreadyCredited) toast.info("Payment already credited");
        else toast.success(`₦${result.amount?.toLocaleString()} added to your wallet!`);
        fetchData();
      })
      .catch((err: unknown) => {
        toast.dismiss(tid);
        toast.error(err instanceof Error ? err.message : "Verification failed — contact support");
      })
      .finally(() => {
        searchParams.delete("ref");
        searchParams.delete("userId");
        searchParams.delete("provider");
        searchParams.delete("cancelled");
        setSearchParams(searchParams, { replace: true });
      });
  }, [searchParams, user]);

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
          <WalletIcon className="w-6 h-6 text-brand-orange" />My Wallet
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Fund your wallet to make instant purchases.</p>
      </div>

      <Card className="mb-6 bg-gradient-to-br from-brand-navy to-brand-navy/90 text-white border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Available Balance</p>
              {dataLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mt-2" />
              ) : (
                <p className="text-3xl font-bold mt-1">₦{Number(wallet?.balance ?? 0).toLocaleString()}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={fetchData} className="text-white hover:bg-white/10">
              <RefreshCw className={`w-5 h-5 ${dataLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {walletError && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{walletError}</CardContent>
        </Card>
      )}

      <FundWallet user={user} wallet={wallet} onFunded={fetchData} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-brand-navy text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-orange" /></div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No transactions yet.</p>
          ) : (
            <TransactionList transactions={transactions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionList({ transactions }: { transactions: Tx[] }) {
  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <Card key={tx.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-green-50" : "bg-red-50"}`}>
                  {tx.type === "credit"
                    ? <ArrowDownCircle className="w-5 h-5 text-green-600" />
                    : <ArrowUpCircle className="w-5 h-5 text-red-500" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-brand-navy">{tx.description ?? (tx.type === "credit" ? "Wallet Credit" : "Purchase")}</div>
                  <div className="text-xs text-muted-foreground">
                    {tx.provider && <span className="capitalize mr-1.5">{tx.provider}</span>}·
                    {" "}{new Date(tx.created_at).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-semibold text-sm ${tx.type === "credit" ? "text-green-600" : "text-red-500"}`}>
                  {tx.type === "credit" ? "+" : "-"}₦{Number(tx.amount).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Bal: ₦{Number(tx.balance_after).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

function FundWallet({ user, wallet, onFunded }: { user: import("@supabase/supabase-js").User; wallet: WalletRow | null; onFunded: () => void }) {
  const [amount, setAmount] = useState("");
  const [opayLoading, setOpayLoading] = useState(false);
  const [monnifyLoading, setMonnifyLoading] = useState(false);
  const [nowLoading, setNowLoading] = useState(false);
  const [cryptoPending, setCryptoPending] = useState<{ reference: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const genRef = () => `ss-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const amt = parseFloat(amount || "0");

  const ensureWalletBeforePayment = async (): Promise<boolean> => {
    if (wallet) return true;
    try {
      const { error } = await supabase.rpc("ensure_user_wallet" as never);
      if (error) { toast.error("Could not set up your wallet — try again"); return false; }
      return true;
    } catch {
      toast.error("Could not set up your wallet — try again");
      return false;
    }
  };

  const handleOpay = async () => {
    if (amt < 100) return toast.error("Minimum amount is ₦100");
    if (!isSupabaseConfigured()) return toast.error("Supabase not configured — add credentials to Replit Secrets");

    setOpayLoading(true);
    const ready = await ensureWalletBeforePayment();
    if (!ready) { setOpayLoading(false); return; }

    const ref = genRef();
    try {
      const result = await initOpayPayment({ amount: amt, userId: user.id, reference: ref });
      setOpayLoading(false);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err: unknown) {
      setOpayLoading(false);
      toast.error(err instanceof Error ? err.message : "Failed to initialize Opay payment");
    }
  };

  const handleMonnify = async () => {
    if (amt < 100) return toast.error("Minimum amount is ₦100");
    if (!isSupabaseConfigured()) return toast.error("Supabase not configured — add credentials to Replit Secrets");

    setMonnifyLoading(true);
    const ready = await ensureWalletBeforePayment();
    if (!ready) { setMonnifyLoading(false); return; }

    const ref = genRef();
    try {
      const result = await initMonnifyPayment({ amount: amt, userId: user.id, reference: ref });
      setMonnifyLoading(false);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err: unknown) {
      setMonnifyLoading(false);
      toast.error(err instanceof Error ? err.message : "Failed to initialize Monnify payment");
    }
  };

  const handleCrypto = async () => {
    if (amt < 500) return toast.error("Minimum amount is ₦500 for crypto payments");
    if (!isSupabaseConfigured()) return toast.error("Supabase not configured — add credentials to Replit Secrets");

    setNowLoading(true);
    const ready = await ensureWalletBeforePayment();
    if (!ready) { setNowLoading(false); return; }

    const ref = genRef();
    try {
      const result = await createNowPaymentsInvoice({ amount: amt, userId: user.id, reference: ref });
      setNowLoading(false);
      if (result.invoiceUrl) {
        setCryptoPending({ reference: ref });
        window.open(result.invoiceUrl, "_blank");
      }
    } catch (err: unknown) {
      setNowLoading(false);
      toast.error(err instanceof Error ? err.message : "Failed to create crypto invoice");
    }
  };

  const handleCheckCryptoStatus = async () => {
    if (!cryptoPending) return;
    setCheckingStatus(true);
    try {
      const result = await checkNowPaymentsStatus({ reference: cryptoPending.reference, userId: user.id });
      setCheckingStatus(false);
      if (result.alreadyCredited) {
        toast.success("Payment confirmed and credited!");
        setCryptoPending(null);
        onFunded();
        setAmount("");
      } else {
        toast.info(`Payment status: ${result.status ?? "pending"} — check again in a moment`);
      }
    } catch (err: unknown) {
      setCheckingStatus(false);
      toast.error(err instanceof Error ? err.message : "Failed to check payment status");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2 text-base">
            <CreditCard className="w-5 h-5 text-brand-orange" />Pay with Opay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Pay via card, bank transfer, or USSD — instant credit.</p>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Quick amounts</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setAmount(String(p))}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${amount === String(p) ? "bg-brand-orange text-white border-brand-orange" : "border-border hover:border-brand-orange hover:text-brand-orange"}`}>
                  ₦{p.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ps-amount">Amount (₦)</Label>
            <Input id="ps-amount" type="number" min="100" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleOpay} disabled={opayLoading || amt < 100} className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white">
            {opayLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pay ₦{amt > 0 ? amt.toLocaleString() : "—"} with Opay
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2 text-base">
            <CreditCard className="w-5 h-5 text-brand-orange" />Pay with Monnify
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Alternative card / bank transfer provider.</p>
          <div>
            <Label htmlFor="mn-amount">Amount (₦)</Label>
            <Input id="mn-amount" type="number" min="100" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleMonnify} disabled={monnifyLoading || amt < 100} variant="outline" className="w-full">
            {monnifyLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Pay ₦{amt > 0 ? amt.toLocaleString() : "—"} with Monnify
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-brand-navy flex items-center gap-2 text-base">
            <Bitcoin className="w-5 h-5 text-brand-orange" />Pay with Crypto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Pay with Bitcoin, USDT, or other supported coins via NOWPayments.</p>
          <div>
            <Label htmlFor="crypto-amount">Amount (₦)</Label>
            <Input id="crypto-amount" type="number" min="500" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
          </div>
          {!cryptoPending ? (
            <Button onClick={handleCrypto} disabled={nowLoading || amt < 500} variant="outline" className="w-full">
              {nowLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Pay ₦{amt > 0 ? amt.toLocaleString() : "—"} with Crypto
            </Button>
          ) : (
            <Button onClick={handleCheckCryptoStatus} disabled={checkingStatus} variant="outline" className="w-full">
              {checkingStatus && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Check Payment Status
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
