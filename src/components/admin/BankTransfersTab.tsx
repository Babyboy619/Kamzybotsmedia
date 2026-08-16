import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Transfer = {
  id: string;
  user_id: string;
  amount: number;
  reference: string;
  sender_name: string;
  status: string;
  created_at: string;
  admin_note: string | null;
  profiles?: { email: string | null; display_name: string | null } | null;
};

export function BankTransfersTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("bank_transfer_requests")
      .select("*, profiles(email, display_name)")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setTransfers((data as Transfer[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const approve = async (id: string) => {
    setProcessing(id);
    const { error } = await supabase.rpc("approve_bank_transfer_request", {
      _request_id: id,
      _admin_note: "Approved by admin",
    });
    if (error) toast.error("Error: " + error.message);
    else toast.success("Transfer approved — wallet credited!");
    setProcessing(null);
    fetchTransfers();
  };

  const reject = async (id: string) => {
    const reason = prompt("Reason for rejection (optional):");
    setProcessing(id);
    const { error } = await supabase.rpc("reject_bank_transfer_request", {
      _request_id: id,
      _reason: reason ?? "Rejected by admin",
    });
    if (error) toast.error("Error: " + error.message);
    else toast.success("Transfer rejected");
    setProcessing(null);
    fetchTransfers();
  };

  const pendingCount = transfers.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-navy text-lg">
          Bank Transfers
          {pendingCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </h2>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-brand-orange text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No {filter === "all" ? "" : filter} transfers found
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border p-4 space-y-3 ${
                t.status === "pending"
                  ? "border-orange-200 bg-orange-50"
                  : t.status === "approved"
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">₦{t.amount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.profiles?.email ?? t.user_id.slice(-8)}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                    t.status === "pending"
                      ? "bg-orange-200 text-orange-800"
                      : t.status === "approved"
                        ? "bg-green-200 text-green-800"
                        : "bg-red-200 text-red-800"
                  }`}
                >
                  {t.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Sender name</span>
                  <div className="font-medium">{t.sender_name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <div className="font-medium">
                    {new Date(t.created_at).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Reference</span>
                  <div className="font-mono font-medium break-all">{t.reference}</div>
                </div>
                {t.admin_note && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Note</span>
                    <div className="font-medium">{t.admin_note}</div>
                  </div>
                )}
              </div>

              {t.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => approve(t.id)}
                    disabled={processing === t.id}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    {processing === t.id ? "Processing..." : "✓ Approve & Credit Wallet"}
                  </button>
                  <button
                    onClick={() => reject(t.id)}
                    disabled={processing === t.id}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
