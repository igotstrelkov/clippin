import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

interface ConnectStatus {
  hasAccount: boolean;
  isComplete: boolean;
  requiresAction?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

export function StripeConnectOnboarding() {
  const [loading, setLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(
    null
  );

  const createConnectAccount = useAction(
    api.payouts.createStripeConnectAccount
  );
  const createOnboardingLink = useAction(
    api.payouts.createConnectOnboardingLink
  );
  const getAccountStatus = useAction(api.payouts.getConnectAccountStatus);
  const user = useQuery(api.auth.loggedInUser);

  useEffect(() => {
    void checkAccountStatus();
  }, []);

  const checkAccountStatus = async () => {
    try {
      const status = await getAccountStatus();
      setConnectStatus(status);
    } catch (error) {
      console.error("Failed to check account status:", error);
    }
  };

  const handleCreateAccount = async () => {
    if (!user?.email) {
      toast.error("Email is required to create a payment account");
      return;
    }

    setLoading(true);
    try {
      await createConnectAccount({ email: user.email });
      toast.success("Payment account created! Now let's complete the setup.");
      await checkAccountStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create account"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    setLoading(true);
    try {
      const result = await createOnboardingLink();
      window.location.href = result.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start onboarding"
      );
      setLoading(false);
    }
  };

  if (connectStatus === null) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!connectStatus.hasAccount) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="bg-primary text-primary-foreground rounded-lg p-3">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Set Up Payments</CardTitle>
            <CardDescription>
              Create your payment account to receive payouts.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>What you'll need:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Government-issued ID</li>
                <li>Bank account information</li>
                <li>Tax information (SSN or EIN)</li>
                <li>Business details (if applicable)</li>
              </ul>
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => {
              void handleCreateAccount();
            }}
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Creating Account..." : "Create Payment Account"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!connectStatus.isComplete) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="bg-yellow-500 text-white rounded-lg p-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Complete Setup</CardTitle>
            <CardDescription>
              Finish setting up your payment account to receive payouts.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Account Status</span>
              <Badge variant="warning">Incomplete</Badge>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${connectStatus.chargesEnabled ? "bg-green-500" : "bg-red-500"}`}
              />
              Charges {connectStatus.chargesEnabled ? "Enabled" : "Disabled"}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${connectStatus.payoutsEnabled ? "bg-green-500" : "bg-red-500"}`}
              />
              Payouts {connectStatus.payoutsEnabled ? "Enabled" : "Disabled"}
            </div>
          </div>
          <Button
            onClick={() => {
              void handleStartOnboarding();
            }}
            disabled={loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Redirecting..." : "Complete Setup"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="bg-green-500 text-white rounded-lg p-3">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div>
          <CardTitle>Payment Account Ready</CardTitle>
          <CardDescription>You can now receive payouts.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Account Status</span>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full mr-2 bg-green-500" />
            Charges Enabled
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full mr-2 bg-green-500" />
            Payouts Enabled
          </div>
        </div>
        <Button
          onClick={() => {
            void checkAccountStatus();
          }}
          variant="secondary"
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </CardContent>
    </Card>
  );
}
