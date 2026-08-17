import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initNeuraPayDeposit, verifyNeuraPayDeposit } from "@/lib/api/payment";

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];
const MIN_AMOUNT = 100;
const STORAGE_KEY = "neurapay:pending";
const POLL_INTERVAL_MS = 12000;

type PendingPayment = {
  reference: string;
  amount: number;
  paymentUrl?: string;
  accountNumber?: string;
  bankName?: string;
  instructions?: string;
};

function loadPending(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayment;
    return parsed?.reference ? parsed : null;
  } catch {
    return null;
  }
}

function savePending(value: PendingPayment | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

type PaymentStatus = "idle" | "processing" | "pending" | "successful" | "failed" | "cancelled";

type Props = {
  userId: string;
  onCompleted: () => void;
};

const STATUS_META: Record<
  Exclude<PaymentStatus, "idle">,
  { label: string; className: string; Icon: typeof Clock }
> = {
  processing: {
    label: "Processing",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    Icon: Loader2,
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-800 border-amber-200",
    Icon: Clock,
  },
  successful: {
    label: "Successful",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle2,
  },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200", Icon: XCircle },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-50 text-slate-700 border-slate-200",
    Icon: XCircle,
  },
};

export default function NeuraPayTopup({ userId, onCompleted }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [payment, setPayment] = useState<PendingPayment | null>(() => loadPending());
  const busyRef = useRef(false);

  const amountNumber = useMemo(() => Number.parseFloat(amount || "0"), [amount]);

  // A pending payment restored from a previous session should show as pending.
  useEffect(() => {
    if (payment && status === "idle") setStatus("pending");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setPayment(null);
    savePending(null);
    setStatus("idle");
    setMessage(null);
  };

  const handleDeposit = async () => {
    if (!Number.isFinite(amountNumber) || amountNumber < MIN_AMOUNT) {
      toast.error(`Minimum deposit is ₦${MIN_AMOUNT}`);
      return;
    }

    setLoading(true);
    setStatus("processing");
    setMessage(null);
    try {
      const result = await initNeuraPayDeposit({
        amount: amountNumber,
        userId,
        reference: `np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      if (result.alreadyCredited) {
        setStatus("successful");
        savePending(null);
        toast.success("This payment was already credited to your wallet.");
        onCompleted();
        return;
      }

      const pending: PendingPayment = {
        reference: result.reference,
        amount: result.amount ?? amountNumber,
        paymentUrl: result.paymentUrl ?? undefined,
        accountNumber: result.accountNumber ?? undefined,
        bankName: result.bankName ?? undefined,
        instructions: result.instructions,
      };
      setPayment(pending);
      savePending(pending);
      setStatus("pending");
      setAmount("");
      toast.success("Payment started. We'll credit your wallet automatically once it clears.");
    } catch (error) {
      setStatus("failed");
      const text = error instanceof Error ? error.message : "Unable to start this payment";
      setMessage(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = useCallback(
    async (silent: boolean) => {
      if (!payment || busyRef.current) return;
      busyRef.current = true;
      if (!silent) {
        setLoading(true);
        setStatus("processing");
      }
      try {
        const result = await verifyNeuraPayDeposit({ reference: payment.reference, userId });

        if (result.success) {
          setStatus("successful");
          setMessage(null);
          setPayment(null);
          savePending(null);
          toast.success(
            result.alreadyCredited
              ? "This payment was already credited."
              : `₦${(result.amount ?? payment.amount).toLocaleString()} added to your wallet.`,
          );
          onCompleted();
          return;
        }

        const remote = String(result.status || "pending").toLowerCase();
        if (remote === "cancelled" || remote === "canceled") setStatus("cancelled");
        else if (["failed", "declined", "reversed", "expired"].includes(remote)) setStatus("failed");
        else setStatus("pending");

        setMessage(result.error ?? "Payment is still pending. We're checking automatically.");
        if (!silent) toast.info(result.error ?? "Payment is still pending.");
      } catch (error) {
        setStatus("pending");
        const text = error instanceof Error ? error.message : "Verification failed";
        setMessage(text);
        if (!silent) toast.error(text);
      } finally {
        busyRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [payment, userId, onCompleted],
  );

  const handleCheckStatus = () => void checkStatus(false);

  // Auto-poll while a payment is outstanding, so the user never has to press
  // anything after paying — and the credit still lands on the server anyway.
  useEffect(() => {
    if (!payment) return;
    const id = window.setInterval(() => void checkStatus(true), POLL_INTERVAL_MS);
    const onFocus = () => void checkStatus(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [payment, checkStatus]);

  const meta = status === "idle" ? null : STATUS_META[status];


  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-brand-navy flex items-center gap-2 text-base">
          <CreditCard className="w-5 h-5 text-brand-orange" />
          NeuraPay Wallet Funding
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use NeuraPay for secure wallet deposits. Every payment is verified with NeuraPay before
          your balance is credited.
        </p>

        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">
            Quick amounts
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${amount === String(preset) ? "bg-brand-orange text-white border-brand-orange" : "border-border hover:border-brand-orange hover:text-brand-orange"}`}
              >
                ₦{preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="neurapay-amount">Amount (₦)</Label>
          <Input
            id="neurapay-amount"
            type="number"
            min={MIN_AMOUNT}
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1"
          />
        </div>

        <Button
          onClick={handleDeposit}
          disabled={loading || !Number.isFinite(amountNumber) || amountNumber < MIN_AMOUNT}
          className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white"
        >
          {loading && status === "processing" && !payment ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Fund Wallet with NeuraPay
        </Button>

        {meta ? (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${meta.className}`}
          >
            <meta.Icon className={`w-4 h-4 ${status === "processing" ? "animate-spin" : ""}`} />
            <span className="font-medium">{meta.label}</span>
            {message ? <span className="opacity-90">— {message}</span> : null}
          </div>
        ) : null}

        {payment ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Payment instructions</p>
                <p className="text-xs mt-1">
                  {payment.instructions ?? "Complete the payment, then verify it below."}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 text-sm space-y-1">
              {payment.bankName ? (
                <p>
                  <span className="font-medium">Bank:</span> {payment.bankName}
                </p>
              ) : null}
              {payment.accountNumber ? (
                <p>
                  <span className="font-medium">Account:</span> {payment.accountNumber}
                </p>
              ) : null}
              <p>
                <span className="font-medium">Amount:</span> ₦{payment.amount.toLocaleString()}
              </p>
              <p className="break-all">
                <span className="font-medium">Reference:</span> {payment.reference}
              </p>
            </div>

            {payment.paymentUrl ? (
              <a
                href={payment.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-medium text-white"
              >
                <ExternalLink className="w-4 h-4" />
                Continue to NeuraPay
              </a>
            ) : null}

            <div className="flex gap-2">
              <Button
                onClick={handleCheckStatus}
                disabled={loading}
                variant="outline"
                className="flex-1 border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Verify Payment
              </Button>
              <Button onClick={reset} variant="ghost" disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
