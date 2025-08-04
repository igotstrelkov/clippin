import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
);

interface CampaignPaymentProps {
  campaignId: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({
  campaignId,
  amount,
  onSuccess,
  onCancel,
}: CampaignPaymentProps) {
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const createPaymentIntent = useAction(
    api.payouts.createCampaignPaymentIntent
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      // Create payment intent
      const { clientSecret } = await createPaymentIntent({
        campaignId: campaignId as any,
        amount: Math.round((amount + amount * 0.029 + 0.3) * 100), // Total amount including fees in cents
      });

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret!,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      );

      if (error) {
        toast.error(error.message || "Payment failed");
      } else if (paymentIntent?.status === "succeeded") {
        toast.success("Campaign funded successfully!");
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Campaign Budget</span>
            <span className="font-bold text-lg">{formatCurrency(amount)}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Processing Fee:</span>
              <span>{formatCurrency(amount * 0.029 + 0.3)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total Charge:</span>
              <span>{formatCurrency(amount + amount * 0.029 + 0.3)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="card-element">Payment Information</Label>
          <div className="border rounded-md p-3">
            <CardElement id="card-element" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!stripe || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading
              ? "Processing..."
              : `Pay ${formatCurrency(amount + amount * 0.029 + 0.3)}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function CampaignPayment(props: CampaignPaymentProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  );
}
