import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
);

console.log(import.meta.env.VITE_STRIPE_WEBHOOK_SECRET as string);

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
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-white font-medium">Campaign Budget</span>
          <span className="text-2xl font-bold text-green-400">
            ${amount.toFixed(2)}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-300">Campaign Budget:</span>
            <span className="text-white">${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Processing Fee:</span>
            <span className="text-white">
              ${(amount * 0.029 + 0.3).toFixed(2)}
            </span>
          </div>
          <div className="border-t border-gray-600 pt-2 flex justify-between font-medium">
            <span className="text-white">Total Charge:</span>
            <span className="text-white">
              ${(amount + amount * 0.029 + 0.3).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Payment Information
          </label>
          <div className="bg-gray-700 p-4 rounded-lg">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#ffffff",
                    "::placeholder": {
                      color: "#9ca3af",
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 text-blue-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-blue-400 font-medium">Important</span>
          </div>
          <p className="text-blue-300 text-sm">
            Your campaign will be activated immediately after successful payment
            and will be visible to creators in the marketplace.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Back to Details
          </button>
          <button
            type="submit"
            disabled={!stripe || loading}
            className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Complete Payment & Launch Campaign"}
          </button>
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
