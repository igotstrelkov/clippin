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
import {
  AlertTriangle,
  DollarSign,
  Eye,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { memo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { PayoutRequestModal } from "./PayoutRequestModal";
import { SubmissionCard } from "./SubmissionCard";
import TikTokVerification from "./TikTokVerification";
import { ViewChart } from "./ViewChart";
import { LoadingSpinner } from "./ui/loading-spinner";

// Type definitions based on Convex queries

export type SubmissionWithCampaign = Doc<"submissions"> & {
  campaignTitle: string | undefined;
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

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          title="Total Earnings"
          value={`${formatCurrency(creatorStats.totalEarnings / 100)}`}
        />
        <StatCard
          icon={ListChecks}
          title="Total Submissions"
          value={creatorStats.totalSubmissions.toLocaleString()}
        />
        <StatCard
          icon={Eye}
          title="Views (24h)"
          value={creatorStats.recent24hViews.toLocaleString()}
        />
        <StatCard
          icon={TrendingUp}
          title="Earnings (24h)"
          value={`${formatCurrency(creatorStats.recent24hEarnings / 100)}`}
        />
      </div>

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

          <Card>
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
              {/* <Button variant="outline" className="w-full">
                Edit Profile
              </Button>
              <Button variant="outline" className="w-full">
                Help & Support
              </Button> */}
            </CardContent>
          </Card>
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
                <DialogTitle>
                  Performance for: {expandedSubmission.campaignTitle}
                </DialogTitle>
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
            creatorName: "You", // This is the creator's own dashboard
            campaignTitle: s.campaignTitle || "Unknown Campaign",
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
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            No submissions yet.
          </div>
        </Card>
      )}
    </div>
  );
}

const StatCard = memo(
  ({
    icon: Icon,
    title,
    value,
  }: {
    icon: React.ElementType;
    title: string;
    value: string;
  }) => {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </Card>
    );
  }
);

// function DashboardSkeleton() {
//   return (
//     <div className="space-y-8 animate-pulse">
//       <Skeleton className="h-9 w-72" />
//       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
//         {[...Array(5)].map((_, i) => (
//           <Skeleton key={i} className="h-24" />
//         ))}
//       </div>
//       <div className="space-y-4">
//         <div className="flex space-x-2 border-b">
//           <Skeleton className="h-10 w-1/2" />
//           <Skeleton className="h-10 w-1/2" />
//         </div>
//         <Card>
//           <CardHeader>
//             <Skeleton className="h-6 w-48" />
//             <Skeleton className="h-4 w-64" />
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-2">
//               {[...Array(3)].map((_, i) => (
//                 <div key={i} className="flex justify-between items-center p-2">
//                   <div className="space-y-2">
//                     <Skeleton className="h-4 w-32" />
//                     <Skeleton className="h-3 w-24" />
//                   </div>
//                   <Skeleton className="h-6 w-20" />
//                   <Skeleton className="h-5 w-16" />
//                   <Skeleton className="h-8 w-8" />
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }
