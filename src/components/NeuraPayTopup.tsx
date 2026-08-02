import { useMemo, useState } from "react";
import { Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initNeuraPayDeposit, verifyNeuraPayDeposit } from "@/lib/api/payment";

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

type Props = {
  userId: string;
  onCompleted: () => void;
};

export default function NeuraPayTopup({ userId, onCompleted }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentState, setPaymentState] = useState<{
    reference: string;
    accountNumber?: string;
    bankName?: string;
    amount: number;
  } | null>(null);

  const amountNumber = useMemo(() => Number.parseFloat(amount || "0"), [amount]);

  const handleDeposit = async () => {
    if (!amountNumber || amountNumber < 100) {
      toast.error("Minimum deposit is ₦100");
      return;
    }

    setLoading(true);
    try {
      const result = await initNeuraPayDeposit({
        amount: amountNumber,
        userId,
        reference: `np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      setPaymentState({
        reference: result.reference,
        accountNumber: result.accountNumber,
        bankName: result.bankName,
        amount: amountNumber,
      });
      toast.success(
        "NeuraPay deposit initialized. Complete the payment and we'll verify it automatically.",
      );
      setAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start NeuraPay deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!paymentState) return;
    setLoading(true);
    try {
      const result = await verifyNeuraPayDeposit({ reference: paymentState.reference, userId });
      if (result.success) {
        toast.success(`₦${result.amount.toLocaleString()} added to your wallet.`);
        setPaymentState(null);
        onCompleted();
      } else {
        toast.info("Payment is still pending. Please try again shortly.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

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
          Use NeuraPay for secure wallet deposits. We verify every payment before crediting your
          balance.
        </p>
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-2 block">
            Quick amounts
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
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
            min="100"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button
          onClick={handleDeposit}
          disabled={loading || amountNumber < 100}
          className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Fund Wallet with NeuraPay
        </Button>

        {paymentState ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Payment instructions</p>
                <p className="text-xs mt-1">
                  Transfer the amount to the NeuraPay virtual account below, then verify the
                  payment.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm space-y-1">
              <p>
                <span className="font-medium">Bank:</span> {paymentState.bankName ?? "NeuraPay"}
              </p>
              <p>
                <span className="font-medium">Account:</span>{" "}
                {paymentState.accountNumber ?? "Pending"}
              </p>
              <p>
                <span className="font-medium">Amount:</span> ₦{paymentState.amount.toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Reference:</span> {paymentState.reference}
              </p>
            </div>
            <Button
              onClick={handleCheckStatus}
              variant="outline"
              className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Verify Payment
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
