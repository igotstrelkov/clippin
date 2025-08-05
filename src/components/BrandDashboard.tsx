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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Loader2, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { CampaignList } from "./dashboard/CampaignList";
import { CampaignStats } from "./dashboard/CampaignStats";
import { SubmissionsList } from "./dashboard/SubmissionsList";
import { EditCampaignModal } from "./EditCampaignModal";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export function BrandDashboard() {
  const brandStats = useQuery(api.campaigns.getBrandStats);
  const submissions = useQuery(api.submissions.getBrandSubmissions);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign);
  const updateSubmissionStatus = useMutation(
    api.submissions.updateSubmissionStatus
  );

  const { pendingSubmissions, reviewedSubmissions } = useMemo(() => {
    if (!submissions)
      return { pendingSubmissions: [], reviewedSubmissions: [] };
    const pending = submissions.filter((s) => s.status === "pending");
    const reviewed = submissions.filter((s) => s.status !== "pending");
    return { pendingSubmissions: pending, reviewedSubmissions: reviewed };
  }, [submissions]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deletingCampaignId, setDeletingCampaignId] =
    useState<Id<"campaigns"> | null>(null);

  if (brandStats === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!brandStats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>
          Could not load your creatorStats. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  const onCampaignEdit = (campaign: any) => {
    setEditingCampaign(campaign);
  };

  const onCampaignDelete = (campaignId: Id<"campaigns">) => {
    setDeletingCampaignId(campaignId);
  };

  const handleDelete = async (campaignId: Id<"campaigns">) => {
    try {
      await deleteCampaign({ campaignId });
      toast.success("Campaign deleted successfully");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete campaign"
      );
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!deletingCampaignId) return;
    const success = await handleDelete(deletingCampaignId);
    if (success) {
      setDeletingCampaignId(null);
    }
  };

  const handleApprove = async (submissionId: Id<"submissions">) => {
    try {
      await updateSubmissionStatus({ submissionId, status: "approved" });
      toast.success("Submission approved successfully");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve submission"
      );
      return false;
    }
  };

  const handleReject = async (
    submissionId: Id<"submissions">,
    rejectionReason: string
  ) => {
    try {
      await updateSubmissionStatus({
        submissionId,
        status: "rejected",
        rejectionReason,
      });
      toast.success("Submission rejected successfully");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject submission"
      );
      return false;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Brand Dashboard</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      <CampaignStats
        stats={brandStats.stats}
        activeCampaignsCount={brandStats.activeCampaigns.length}
      />

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          {/* <TabsTrigger value="analytics">Analytics</TabsTrigger> */}
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignList
            activeCampaigns={brandStats.activeCampaigns}
            draftCampaigns={brandStats.draftCampaigns}
            onEdit={onCampaignEdit}
            onDelete={onCampaignDelete}
          />
        </TabsContent>

        <TabsContent value="submissions">
          <SubmissionsList
            pendingSubmissions={pendingSubmissions}
            reviewedSubmissions={reviewedSubmissions}
            isLoading={false}
            onApprove={(id) => void handleApprove(id)}
            onReject={(id, reason) => void handleReject(id, reason)}
            userType={profile?.userType as "creator" | "brand"}
          />
        </TabsContent>

        {/* <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent> */}
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
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
