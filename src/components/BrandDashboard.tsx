import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { EditCampaignModal } from "./EditCampaignModal";
import { SubmissionsReviewModal } from "./SubmissionsReviewModal";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
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
import {
  DollarSign,
  Eye,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Package,
  PlusCircle,
} from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import { SubmissionCard } from "./SubmissionCard";

// This type is based on the data returned from the getBrandCampaigns query
type Campaign = {
  _id: Id<"campaigns">;
  _creationTime: number;
  title: string;
  status: "active" | "draft" | "completed" | "paused";
  totalBudget: number;
  remainingBudget: number;
  totalSubmissions?: number;
  approvedSubmissions?: number;
  totalViews?: number;
  updatedTime?: number;
};

export function BrandDashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [reviewingCampaign, setReviewingCampaign] = useState<Campaign | null>(
    null
  );
  const [deletingCampaignId, setDeletingCampaignId] =
    useState<Id<"campaigns"> | null>(null);

  const campaigns = useQuery(api.campaigns.getBrandCampaigns);
  const submissions = useQuery(api.submissions.getBrandSubmissions);
  const updateSubmissionStatus = useMutation(
    api.submissions.updateSubmissionStatus
  );
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign);

  const handleDelete = async () => {
    if (!deletingCampaignId) return;
    try {
      await deleteCampaign({ campaignId: deletingCampaignId });
      toast.success("Campaign deleted successfully");
      setDeletingCampaignId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete campaign"
      );
    }
  };

  const handleApprove = (submissionId: Id<"submissions">) => {
    updateSubmissionStatus({ submissionId, status: "approved" })
      .then(() => {
        toast.success("Submission approved successfully");
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to approve submission"
        );
      });
  };

  const handleReject = (submissionId: Id<"submissions">) => {
    updateSubmissionStatus({
      submissionId,
      status: "rejected",
      rejectionReason: "Not specified",
    })
      .then(() => {
        toast.success("Submission rejected successfully");
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to reject submission"
        );
      });
  };

  const { activeCampaigns, stats } = useMemo(() => {
    if (!campaigns) {
      return {
        activeCampaigns: [],
        stats: {
          totalSpent: 0,
          totalViews: 0,
          totalSubmissions: 0,
          avgCpm: 0,
        },
      };
    }
    const active = campaigns.filter((c) => c.status === "active");

    const totalSpent = campaigns.reduce(
      (sum, c) => sum + (c.totalBudget - c.remainingBudget),
      0
    );
    const totalViews = campaigns.reduce(
      (sum, c) => sum + (c.totalViews || 0),
      0
    );
    const totalSubmissions = campaigns.reduce(
      (sum, c) => sum + (c.totalSubmissions || 0),
      0
    );
    // Calculate average CPM (Cost Per Mille = cost per 1000 views)
    const avgCpm = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;
    return {
      activeCampaigns: active,
      stats: { totalSpent, totalViews, totalSubmissions, avgCpm },
    };
  }, [campaigns]);

  const { pendingSubmissions, reviewedSubmissions } = useMemo(() => {
    if (!submissions)
      return { pendingSubmissions: [], reviewedSubmissions: [] };
    const pending = submissions.filter((s) => s.status === "pending");
    const reviewed = submissions.filter((s) => s.status !== "pending");
    return { pendingSubmissions: pending, reviewedSubmissions: reviewed };
  }, [submissions]);

  const submissionsLoading = submissions === undefined;

  if (campaigns === undefined) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Brand Dashboard</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={DollarSign}
          title="Total Spent"
          value={`$${(stats.totalSpent / 100).toLocaleString()}`}
        />
        <StatCard
          icon={Eye}
          title="Total Views"
          value={stats.totalViews.toLocaleString()}
        />
        <StatCard
          icon={Package}
          title="Active Campaigns"
          value={activeCampaigns.length.toString()}
        />
        <StatCard
          icon={DollarSign}
          title="Avg CPM"
          value={`$${(stats.avgCpm / 100).toFixed(2)}`}
        />
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Campaign Management
              </h2>
              <p className="text-muted-foreground mb-6">
                Monitor and manage your active campaigns
              </p>

              {/* Campaign Cards */}
              <div className="space-y-4">
                {activeCampaigns.map((campaign) => (
                  <Card key={campaign._id} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <h3 className="text-lg font-semibold">
                          {campaign.title}
                        </h3>
                        <Badge variant="secondary">Fashion</Badge>
                        <Badge variant="outline">{campaign.status}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingCampaign(campaign)}
                          >
                            Edit Campaign
                          </DropdownMenuItem>
                          {/* <DropdownMenuItem
                            onClick={() => setReviewingCampaign(campaign)}
                          >
                            View Submissions
                          </DropdownMenuItem> */}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletingCampaignId(campaign._id)}
                          >
                            Delete Campaign
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-4 gap-6 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Budget Used
                        </p>
                        <p className="text-lg font-semibold">
                          $
                          {(
                            (campaign.totalBudget - campaign.remainingBudget) /
                            100
                          ).toLocaleString()}{" "}
                          / ${(campaign.totalBudget / 100).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Views</p>
                        <p className="text-lg font-semibold">
                          {(campaign.totalViews || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Submissions
                        </p>
                        <p className="text-lg font-semibold">
                          {campaign.approvedSubmissions || 0}/
                          {campaign.totalSubmissions || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">CPM</p>
                        <p className="text-lg font-semibold">
                          $
                          {campaign.totalViews && campaign.totalViews > 0
                            ? (
                                (((campaign.totalBudget -
                                  campaign.remainingBudget) /
                                  campaign.totalViews) *
                                  1000) /
                                100
                              ).toFixed(2)
                            : "0.00"}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Budget Progress</span>
                        <span>
                          {Math.round(
                            ((campaign.totalBudget - campaign.remainingBudget) /
                              campaign.totalBudget) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <Progress
                        value={
                          ((campaign.totalBudget - campaign.remainingBudget) /
                            campaign.totalBudget) *
                          100
                        }
                      />
                      {/* <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.round(((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) * 100)}%`,
                          }}
                        ></div>
                      </div> */}
                    </div>

                    {(campaign.totalSubmissions || 0) >
                      (campaign.approvedSubmissions || 0) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          {(campaign.totalSubmissions || 0) -
                            (campaign.approvedSubmissions || 0)}{" "}
                          submissions pending review
                        </p>
                      </div>
                    )}
                  </Card>
                ))}

                {activeCampaigns.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">
                      No Active Campaigns
                    </h3>
                    <p className="mt-1 text-sm">
                      Create your first campaign to get started.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="submissions">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>
              <p className="text-muted-foreground mb-6">
                Review and approve creator submissions
              </p>

              {submissionsLoading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (submissions ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="mx-auto h-12 w-12" />
                  <h3 className="mt-4 text-lg font-medium">
                    No Recent Submissions
                  </h3>
                  <p className="mt-1 text-sm">
                    Submissions will appear here when creators submit content.
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="pending" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">
                      Pending ({pendingSubmissions.length})
                    </TabsTrigger>
                    <TabsTrigger value="reviewed">
                      Reviewed ({reviewedSubmissions.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                    <div className="space-y-4 mt-4">
                      {pendingSubmissions.map((submission) => (
                        <SubmissionCard
                          key={submission._id}
                          submission={submission}
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      ))}
                      {pendingSubmissions.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>No pending submissions.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="reviewed">
                    <div className="space-y-4 mt-4">
                      {reviewedSubmissions.map((submission) => (
                        <SubmissionCard
                          key={submission._id}
                          submission={submission}
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      ))}
                      {reviewedSubmissions.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>No reviewed submissions.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Performance Analytics
              </h2>
              <p className="text-muted-foreground mb-6">
                Detailed insights into your campaign performance
              </p>

              <Card className="p-12">
                <div className="text-center text-muted-foreground">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
                    <Eye className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    Campaign Performance Over Time
                  </h3>
                  <p className="text-sm mb-8">Interactive charts coming soon</p>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {showCreateModal && (
        <CreateCampaignModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}
      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          isOpen={!!editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSuccess={() => setEditingCampaign(null)}
        />
      )}
      {reviewingCampaign && (
        <SubmissionsReviewModal
          campaignId={reviewingCampaign._id}
          onClose={() => setReviewingCampaign(null)}
        />
      )}

      <AlertDialog
        open={!!deletingCampaignId}
        onOpenChange={(open) => !open && setDeletingCampaignId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              campaign and all of its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Skeleton className="h-5 w-32" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-5 w-20" />
                  </TableHead>
                  <TableHead className="text-right">
                    <Skeleton className="h-5 w-24 ml-auto" />
                  </TableHead>
                  <TableHead className="text-right">
                    <Skeleton className="h-5 w-16 ml-auto" />
                  </TableHead>
                  <TableHead className="text-right">
                    <Skeleton className="h-5 w-28 ml-auto" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-5 w-24" />
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-12 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-16 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
