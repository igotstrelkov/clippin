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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, DollarSign, Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../ui/empty-state";
import { LoadingSpinner } from "../ui/loading-spinner";

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
  const [selectedSubmissions, setSelectedSubmissions] = useState<
    Id<"submissions">[]
  >([]);

  const createConnectAccount = useAction(
    api.payouts.createStripeConnectAccount
  );
  const createOnboardingLink = useAction(
    api.payouts.createConnectOnboardingLink
  );
  const getAccountStatus = useAction(api.payouts.getConnectAccountStatus);
  const processPayout = useAction(api.payouts.processPayout);
  const user = useQuery(api.auth.loggedInUser);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
  const pendingPayouts = useQuery(api.payoutHelpers.getPendingPayouts);

  const checkAccountStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getAccountStatus();

      setConnectStatus(status);
    } catch (error) {
      // Log error for debugging (replace with proper error tracking in production)
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to check account status:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [getAccountStatus]);

  useEffect(() => {
    void checkAccountStatus();
  }, [checkAccountStatus]);

  // Payout functionality
  const selectedEarnings = selectedSubmissions.reduce((total, submissionId) => {
    const submission = pendingEarnings?.submissions.find(
      (s) => s._id === submissionId
    );
    return total + (submission?.pendingAmount || 0);
  }, 0);

  const handleSubmissionToggle = (submissionId: Id<"submissions">) => {
    setSelectedSubmissions((prev) =>
      prev.includes(submissionId)
        ? prev.filter((id) => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && pendingEarnings) {
      setSelectedSubmissions(pendingEarnings.submissions.map((s) => s._id));
    } else {
      setSelectedSubmissions([]);
    }
  };

  const handleRequestPayout = async () => {
    if (!profile?.stripeConnectAccountId) {
      toast.error("Please complete your payment account setup first");
      return;
    }

    setLoading(true);
    try {
      const response = await processPayout({
        creatorId: profile.userId,
        amount: selectedEarnings,
        submissionIds: selectedSubmissions,
      });

      if (response.success) {
        toast.success("Payout request submitted successfully!", {
          description:
            "Your payout is being processed and will arrive in 2-7 business days.",
        });
        setSelectedSubmissions([]);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process payout"
      );
    } finally {
      setLoading(false);
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
      <>
        <Alert className="flex flex-row items-center gap-4">
          <div className="bg-primary text-primary-foreground rounded-lg p-3">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Set Up Payments</CardTitle>
            <CardDescription>
              Create your payment account to receive payouts.
            </CardDescription>
          </div>
        </Alert>
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>What you'll need:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Government-issued ID</li>
                <li>Bank account information</li>
                <li>Tax information (SSN or EIN)</li>
                {/* <li>Business details (if applicable)</li> */}
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
            {loading && <LoadingSpinner size="sm" centered={false} />}
            {loading ? "Creating Account..." : "Create Payment Account"}
          </Button>
        </div>
      </>
    );
  }

  if (!connectStatus.isComplete) {
    return (
      <>
        <Alert className="flex flex-row items-center gap-4">
          <div className="bg-yellow-500 text-white rounded-lg p-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Complete Setup</CardTitle>
            <CardDescription>
              Finish setting up your payment account to receive payouts.
            </CardDescription>
          </div>
        </Alert>
        <div className="space-y-4">
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
            {loading && <LoadingSpinner size="sm" centered={false} />}
            {loading ? "Redirecting..." : "Complete Setup"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Payouts Section
        {pendingPayouts && pendingPayouts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold text-lg">Processing Payouts</h3>
            </div>
            <Alert className="border-orange-200 bg-orange-50">
              <Clock className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">
                Payouts in Progress
              </AlertTitle>
              <AlertDescription className="text-orange-700">
                Your payout requests are being processed. Funds typically arrive
                in 2-7 business days.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              {pendingPayouts.map((payout) => (
                <div
                  key={payout._id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div>
                    <div className="font-medium">
                      {payout.campaignTitles.join(", ") || "Multiple campaigns"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Requested{" "}
                      {new Date(payout.createdAt).toLocaleDateString()} •{" "}
                      {payout.submissionCount} submission
                      {payout.submissionCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">
                      {formatCurrency(payout.amount / 100)}
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-800"
                    >
                      Processing
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
          </div>
        )} */}

        {/* Available Earnings Section */}
        <div className="space-y-4">
          <div className="max-h-[40vh] overflow-y-auto pr-4">
            {pendingEarnings === undefined ? (
              <div className="flex justify-center items-center h-48">
                <LoadingSpinner />
              </div>
            ) : pendingEarnings.submissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          pendingEarnings.submissions.length > 0 &&
                          selectedSubmissions.length ===
                            pendingEarnings.submissions.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEarnings.submissions.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSubmissions.includes(s._id)}
                          onCheckedChange={() => handleSubmissionToggle(s._id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.campaignTitle}
                      </TableCell>
                      <TableCell>
                        {new Date(s.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency((s.pendingAmount || 0) / 100)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title={
                  pendingPayouts && pendingPayouts.length > 0
                    ? "No Additional Earnings"
                    : "No Pending Payouts"
                }
                description={
                  pendingPayouts && pendingPayouts.length > 0
                    ? "All current earnings are being processed."
                    : "Approved submissions with earnings will appear here."
                }
              />
            )}
          </div>

          {/* Payout Actions */}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-lg font-semibold">
              Selected:{" "}
              <span className="font-mono text-primary">
                {formatCurrency(selectedEarnings / 100)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleRequestPayout()}
                disabled={loading || selectedEarnings === 0}
              >
                {loading && <LoadingSpinner size="sm" centered={false} />}
                {loading ? "Processing..." : "Request Payout"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
