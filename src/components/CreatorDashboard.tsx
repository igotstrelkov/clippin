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
import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { PayoutRequestModal } from "./creator-dashboard/PayoutRequestModal";
import TikTokVerification from "./creator-dashboard/TikTokVerification";
import { CreatorStats } from "./DashboardStats";
import { SubmissionCard } from "./SubmissionCard";
import { EmptyState } from "./ui/empty-state";
import { LoadingSpinner } from "./ui/loading-spinner";
import { ViewChart } from "./ViewChart";

// Type definitions based on Convex queries

export type SubmissionWithCampaign = Doc<"submissions"> & {
  campaignTitle: string | undefined;
  brandName: string | undefined;
  status: "approved" | "rejected" | "pending";
  rejectionReason?: string;
  earnings?: number;
  tiktokVideoUrl?: string;
};

export function CreatorDashboard() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [expandedSubmission, setExpandedSubmission] =
    useState<SubmissionWithCampaign | null>(null);

  const creatorStats = useQuery(api.profiles.getCreatorStats);
  const submissions: SubmissionWithCampaign[] | undefined = useQuery(
    api.submissions.getCreatorSubmissions
  );
  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
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
      <h1 className="text-3xl font-bold">Creator Dashboard</h1>
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
                  Stripe Connect Setup Complete!
                </AlertTitle>
                <AlertDescription className="text-green-700">
                  Your payment account has been successfully connected. You can
                  now receive payouts.
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
                Ready to withdraw
              </div>
              <Button
                className="w-full"
                disabled={pendingEarnings?.totalPending === 0}
                onClick={() => setShowPayoutModal(true)}
              >
                Request Payout
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Payouts processed weekly via Stripe Connect
              </p>
            </CardContent>
          </Card>

          {/* <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowTikTokModal(true)}
              >
                Verify TikTok Account
              </Button>
              <Button variant="outline" className="w-full">
                Edit Profile
              </Button>
              <Button variant="outline" className="w-full">
                Help & Support
              </Button>
            </CardContent>
          </Card> */}
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
                  {/* <ViewTracker
                    submissionId={expandedSubmission._id}
                    showRefreshButton
                  /> */}
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

      {showPayoutModal && (
        <PayoutRequestModal
          isOpen={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
        />
      )}
    </div>
  );
}

function SubmissionsSection({
  submissions,
  onExpand,
}: {
  submissions: SubmissionWithCampaign[] | undefined;
  onExpand: (s: SubmissionWithCampaign) => void;
}) {
  const profile = useQuery(api.profiles.getCurrentProfile);
  return (
    <div className="space-y-4">
      {submissions && submissions.length > 0 ? (
        submissions.map((s) => {
          // Convert SubmissionWithCampaign to Submission type for SubmissionCard
          const submissionForCard = {
            _id: s._id,
            status: s.status,
            creatorName: s.campaignTitle || "Unknown Campaign", // This is the creator's own dashboard
            campaignTitle: `by ${s.brandName}`,
            submittedAt: s._creationTime,
            viewCount: s.viewCount,
            earnings: s.earnings,
            tiktokUrl: s.tiktokUrl || "",
            rejectionReason: s.rejectionReason,
          };

          return (
            <SubmissionCard
              key={s._id}
              submission={submissionForCard}
              onExpand={() => onExpand(s)}
              userType={profile?.userType}
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
