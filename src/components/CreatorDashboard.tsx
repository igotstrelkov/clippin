import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { CreatorQuerySubmission, UISubmission } from "@/types/ui";
import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { PayoutHistory } from "./creator-dashboard/PayoutHistory";
import { PayoutRequestModal } from "./creator-dashboard/PayoutRequestModal";
import TikTokVerification from "./creator-dashboard/TikTokVerification";
import ViewAccountsModal from "./creator-dashboard/ViewAccountsModal";
import { CreatorStats } from "./DashboardStats";
import { SubmissionCard } from "./SubmissionCard";
import { EmptyState } from "./ui/empty-state";
import { LoadingSpinner } from "./ui/loading-spinner";
import { ViewChart } from "./ViewChart";

export function CreatorDashboard() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [showViewAccountsModal, setShowViewAccountsModal] = useState(false);
  const [expandedSubmission, setExpandedSubmission] =
    useState<UISubmission | null>(null);

  const creatorStats = useQuery(api.profiles.getCreatorStats);
  const submissions = useQuery(api.submissions.getCreatorSubmissions) as
    | CreatorQuerySubmission[]
    | undefined;
  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
  // const pendingPayouts = useQuery(api.payoutHelpers.getPendingPayouts);
  const profile = useQuery(api.profiles.getCurrentProfile);

  if (creatorStats === undefined) {
    return <LoadingSpinner />;
  }

  if (!creatorStats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>
          Could not load your dashboard. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Creator Dashboard</h1>
        <Button onClick={() => setShowViewAccountsModal(true)}>
          Verified Accounts
        </Button>
      </div>
      {!profile?.tiktokVerified && (
        <Alert variant="destructive">
          <div className="flex justify-between items-center">
            <div>
              <AlertTitle>TikTok account not verified</AlertTitle>

              <AlertDescription>
                Please verify your TikTok account to start connecting with
                brands.
              </AlertDescription>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowTikTokModal(true)}
            >
              Verify
            </Button>
          </div>
        </Alert>
      )}
      {/* Success alert for Stripe Connect */}
      {typeof window !== "undefined" &&
        window.location.search.includes("connected=true") && (
          <Alert variant="default" className="border-green-200 bg-green-50">
            <div className="flex justify-between items-center">
              <div>
                <AlertTitle className="text-green-800">
                  Payment account setup complete!
                </AlertTitle>
                <AlertDescription className="text-green-700">
                  Your payment account has been successfully setup. You can now
                  receive payouts.
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

      <CreatorStats stats={creatorStats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>
                Track your campaign submissions and earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionsSection
                submissions={submissions}
                onExpand={setExpandedSubmission}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Pending Payouts Card */}
          {/* {pendingPayouts && pendingPayouts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  Processing Payouts
                </CardTitle>
                <CardDescription>
                  {pendingPayouts.reduce((sum, p) => sum + p.amount, 0) / 100}{" "}
                  in payouts being processed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingPayouts.map((payout) => (
                    <div
                      key={payout._id}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {payout.campaignTitles.join(", ") ||
                            "Multiple campaigns"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Requested{" "}
                          {new Date(payout.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {formatCurrency(payout.amount / 100)}
                        </div>
                        <div className="text-xs text-orange-600">
                          2-7 business days
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )} */}

          {/* Available Payouts Card */}
          <Card>
            <CardHeader>
              <CardTitle>Available Payout</CardTitle>
              <CardDescription>
                Request payout anytime, no minimum required
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold">
                {formatCurrency((pendingEarnings?.totalPending || 0) / 100)}
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                {pendingEarnings?.totalPending === 0
                  ? "No earnings available"
                  : "Ready to withdraw"}
              </div>
              <Button
                className="w-full"
                disabled={pendingEarnings?.totalPending === 0}
                onClick={() => setShowPayoutModal(true)}
              >
                Request Payout
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Payouts processed via Stripe Connect (2-7 business days)
              </p>
            </CardContent>
          </Card>

          <PayoutHistory />
        </div>
      </div>

      <Dialog
        open={!!expandedSubmission}
        onOpenChange={(isOpen) => !isOpen && setExpandedSubmission(null)}
      >
        <DialogContent className="max-w-3xl">
          {expandedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle>{expandedSubmission.campaignTitle}</DialogTitle>
                <DialogDescription>
                  Submitted on{" "}
                  {new Date(
                    expandedSubmission.submittedAt ??
                      expandedSubmission._creationTime
                  ).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {expandedSubmission.status === "rejected" &&
                  expandedSubmission.rejectionReason && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Rejection Feedback</AlertTitle>
                      <AlertDescription>
                        {expandedSubmission.rejectionReason}
                      </AlertDescription>
                    </Alert>
                  )}
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <ViewChart submissionId={expandedSubmission._id} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showTikTokModal} onOpenChange={setShowTikTokModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify TikTok Account</DialogTitle>
            <DialogDescription>
              Verify your TikTok account to connect with brands.
            </DialogDescription>
          </DialogHeader>
          <TikTokVerification />
        </DialogContent>
      </Dialog>

      <PayoutRequestModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
      />

      <ViewAccountsModal
        isOpen={showViewAccountsModal}
        onClose={() => setShowViewAccountsModal(false)}
      />
    </div>
  );
}

function SubmissionsSection({
  submissions,
  onExpand,
}: {
  submissions: CreatorQuerySubmission[] | undefined;
  onExpand: (s: UISubmission) => void;
}) {
  const profile = useQuery(api.profiles.getCurrentProfile);
  return (
    <div className="space-y-4">
      {submissions && submissions.length > 0 ? (
        submissions.map((s) => {
          // Convert item to UISubmission for the card
          const submissionForCard: UISubmission = {
            ...s,
            // On creator dashboard, surface brand name prominently
            creatorName: s.brandName || "Brand",
            campaignTitle: s.campaignTitle || "Campaign",
            submittedAt: s.submittedAt ?? s._creationTime,
          };

          return (
            <SubmissionCard
              key={s._id}
              submission={submissionForCard}
              onExpand={() => onExpand(submissionForCard)}
              userType={
                profile?.userType === "brand" || profile?.userType === "creator"
                  ? profile.userType
                  : undefined
              }
            />
          );
        })
      ) : (
        <EmptyState
          title="No Submissions"
          description="Navigate to marketplace to create your first submission."
        />
      )}
    </div>
  );
}
