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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  DollarSign,
  Eye,
  History,
  ListChecks,
  MoreHorizontal,
  TrendingUp,
  Video,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PayoutRequestModal } from "./PayoutRequestModal";
import { StripeConnectOnboarding } from "./StripeConnectOnboarding";
import TikTokVerification from "./TikTokVerification";
import { ViewChart } from "./ViewChart";
import { ViewTracker } from "./ViewTracker";

// Type definitions based on Convex queries

type Payout = {
  _id: Id<"payments">;
  amount: number;
  createdAt: number;
  status: "completed" | "failed" | "pending";
};

type Submission = {
  _id: Id<"submissions">;
  campaignTitle: string;
  submittedAt: number;
  status: "approved" | "rejected" | "pending";
  rejectionReason?: string;
  earnings?: number;
  tiktokVideoUrl?: string;
};

export function CreatorDashboard() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [expandedSubmission, setExpandedSubmission] =
    useState<Submission | null>(null);

  const stats = useQuery(api.profiles.getCreatorStats);
  const submissions = useQuery(api.submissions.getCreatorSubmissions);
  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
  const payouts = useQuery(api.payoutHelpers.getCreatorPayouts);

  const isLoading =
    stats === undefined ||
    submissions === undefined ||
    pendingEarnings === undefined ||
    payouts === undefined;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!stats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>
          Could not load your stats. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Creator Dashboard</h1>

      {!stats.tiktokVerified && <TikTokVerification />}
      <StripeConnectOnboarding />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={DollarSign}
          title="Total Earnings"
          value={`$${(stats.totalEarnings / 100).toLocaleString()}`}
        />
        <StatCard
          icon={Wallet}
          title="Pending Payout"
          value={`$${((pendingEarnings?.totalPending || 0) / 100).toLocaleString()}`}
        />
        <StatCard
          icon={ListChecks}
          title="Total Submissions"
          value={stats.totalSubmissions.toLocaleString()}
        />
        <StatCard
          icon={Eye}
          title="Views (24h)"
          value={stats.recent24hViews.toLocaleString()}
        />
        <StatCard
          icon={TrendingUp}
          title="Earnings (24h)"
          value={`$${(stats.recent24hEarnings / 100).toLocaleString()}`}
        />
      </div>

      <Tabs defaultValue="submissions">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions">
          <SubmissionsSection
            submissions={submissions}
            onExpand={setExpandedSubmission}
          />
        </TabsContent>
        <TabsContent value="payouts">
          <PayoutsSection
            payouts={payouts}
            pendingAmount={pendingEarnings?.totalPending || 0}
            onRequestPayout={() => setShowPayoutModal(true)}
          />
        </TabsContent>
      </Tabs>

      {expandedSubmission && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              Performance for: {expandedSubmission.campaignTitle}
            </CardTitle>
            <CardDescription>
              Submitted on{" "}
              {new Date(expandedSubmission.submittedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ViewTracker
                submissionId={expandedSubmission._id}
                showRefreshButton
              />
              {/* <StatCard
                icon={DollarSign}
                title="Total Earnings"
                value={`$${((expandedSubmission.earnings || 0) / 100).toLocaleString()}`}
              /> */}
              <ViewChart submissionId={expandedSubmission._id} />
            </div>
          </CardContent>
        </Card>
      )}

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
  submissions: Submission[] | undefined;
  onExpand: (s: Submission) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Earnings</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions && submissions.length > 0 ? (
              submissions.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">
                    {s.campaignTitle}
                  </TableCell>
                  <TableCell>
                    {new Date(s.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        s.status === "approved"
                          ? "default"
                          : s.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {s.earnings
                      ? `$${(s.earnings / 100).toLocaleString()}`
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onExpand(s)}>
                          View Performance
                        </DropdownMenuItem>
                        {s.tiktokVideoUrl && (
                          <DropdownMenuItem asChild>
                            <a
                              href={s.tiktokVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View on TikTok
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Video className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">
                    No Submissions Yet
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Browse campaigns and submit a video to start earning.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayoutsSection({
  payouts,
  pendingAmount,
  onRequestPayout,
}: {
  payouts: Payout[] | undefined;
  pendingAmount: number;
  onRequestPayout: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>
              Your requested payouts and their status.
            </CardDescription>
          </div>
          {pendingAmount > 0 && (
            <Button onClick={onRequestPayout}>
              Request Payout (${(pendingAmount / 100).toLocaleString()})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts && payouts.length > 0 ? (
              payouts.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.status === "completed"
                          ? "default"
                          : p.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${(p.amount / 100).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <History className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No Payouts Yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your payout history will appear here.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
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

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="flex space-x-2 border-b">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-1/2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-2">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
