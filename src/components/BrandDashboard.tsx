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
  FileWarning,
  FolderOpen,
  ListChecks,
  MoreHorizontal,
  Package,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

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

  const { activeCampaigns, draftCampaigns, completedCampaigns, stats } =
    useMemo(() => {
      if (!campaigns) {
        return {
          activeCampaigns: [],
          draftCampaigns: [],
          completedCampaigns: [],
          stats: { totalSpent: 0, totalViews: 0, totalSubmissions: 0 },
        };
      }
      const active = campaigns.filter((c) => c.status === "active");
      const drafts = campaigns.filter((c) => c.status === "draft");
      const completed = campaigns.filter((c) => c.status === "completed");
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
      return {
        activeCampaigns: active,
        draftCampaigns: drafts,
        completedCampaigns: completed,
        stats: { totalSpent, totalViews, totalSubmissions },
      };
    }, [campaigns]);

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
          icon={ListChecks}
          title="Total Submissions"
          value={stats.totalSubmissions.toString()}
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts{" "}
            <Badge variant="destructive" className="ml-2">
              {draftCampaigns.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <CampaignsTable
            campaigns={activeCampaigns}
            setEditingCampaign={setEditingCampaign}
            setReviewingCampaign={setReviewingCampaign}
            setDeletingCampaignId={setDeletingCampaignId}
          />
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardContent>
              {/* <CardHeader>
                <CardTitle>Draft Campaigns</CardTitle>
              </CardHeader> */}

              {draftCampaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileWarning className="mx-auto h-12 w-12" />
                  <h3 className="mt-4 text-lg font-medium">No Drafts</h3>
                  <p className="mt-1 text-sm">
                    You have no campaigns awaiting payment.
                  </p>
                </div>
              ) : (
                <>
                  {/* <CardHeader>
                    <CardTitle>Draft Campaigns</CardTitle>
                    <AlertDescription>
                      These campaigns are not yet active. Complete payment to
                      make them available to creators.
                    </AlertDescription>
                  </CardHeader> */}
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draftCampaigns.map((campaign) => (
                          <TableRow key={campaign._id}>
                            <TableCell className="font-medium">
                              {campaign.title}
                            </TableCell>
                            <TableCell>
                              ${(campaign.totalBudget / 100).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                campaign._creationTime
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => setEditingCampaign(campaign)}
                                >
                                  Complete Payment
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="px-2"
                                  onClick={() =>
                                    setDeletingCampaignId(campaign._id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <CampaignsTable
            campaigns={completedCampaigns}
            setEditingCampaign={setEditingCampaign}
            setReviewingCampaign={setReviewingCampaign}
            setDeletingCampaignId={setDeletingCampaignId}
          />
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

function CampaignsTable({
  campaigns,
  setEditingCampaign,
  setReviewingCampaign,
  setDeletingCampaignId,
}: {
  campaigns: Campaign[];
  setEditingCampaign: (c: Campaign) => void;
  setReviewingCampaign: (c: Campaign) => void;
  setDeletingCampaignId: (id: Id<"campaigns">) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <FolderOpen className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-medium">No Campaigns Found</h3>
          <p className="mt-1 text-sm">
            There are no campaigns in this category.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Submissions</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign._id}>
                <TableCell className="font-medium">{campaign.title}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      campaign.status === "active" ? "default" : "outline"
                    }
                  >
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-mono">
                    ${(campaign.remainingBudget / 100).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    of ${(campaign.totalBudget / 100).toLocaleString()}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(campaign.totalViews || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {campaign.approvedSubmissions || 0} /{" "}
                  {campaign.totalSubmissions || 0}
                </TableCell>
                <TableCell>
                  {campaign.updatedTime
                    ? new Date(campaign.updatedTime).toLocaleDateString()
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
                      <DropdownMenuItem
                        onClick={() => setReviewingCampaign(campaign)}
                      >
                        Review Submissions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingCampaign(campaign)}
                      >
                        Edit Campaign
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingCampaignId(campaign._id)}
                      >
                        Delete Campaign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
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
