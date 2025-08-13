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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UICampaign, UISubmission } from "@/types/ui";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CampaignList } from "./brand-dashboard/CampaignList";
import { EditCampaignModal } from "./brand-dashboard/EditCampaignModal";
import { SubmissionsList } from "./creator-dashboard/SubmissionsList";
import { BrandStats } from "./DashboardStats";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { LoadingSpinner } from "./ui/loading-spinner";

export function BrandDashboard() {
  const brandStats = useQuery(api.campaigns.getBrandStats);
  const submissions = useQuery(api.submissions.getBrandSubmissions) as
    | UISubmission[]
    | undefined;
  const profile = useQuery(api.profiles.getCurrentProfile);
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign);
  const updateSubmissionStatus = useMutation(
    api.submissions.updateSubmissionStatus
  );

  const isSubmissionsLoading = submissions === undefined;
  const userType: "creator" | "brand" =
    profile?.userType === "brand" || profile?.userType === "creator"
      ? profile.userType
      : "brand";

  const { pendingSubmissions, reviewedSubmissions } = useMemo<{
    pendingSubmissions: UISubmission[];
    reviewedSubmissions: UISubmission[];
  }>(() => {
    const list = submissions ?? [];
    const pending = list.filter((s) => s.status === "pending");
    const reviewed = list.filter((s) => s.status !== "pending");
    return { pendingSubmissions: pending, reviewedSubmissions: reviewed };
  }, [submissions]);

  const [editingCampaign, setEditingCampaign] = useState<UICampaign | null>(
    null
  );
  const [deletingCampaignId, setDeletingCampaignId] =
    useState<Id<"campaigns"> | null>(null);

  const onCampaignEdit = useCallback((campaign: UICampaign) => {
    setEditingCampaign(campaign);
  }, []);

  const onCampaignDelete = useCallback((campaignId: Id<"campaigns">) => {
    setDeletingCampaignId(campaignId);
  }, []);

  const handleDelete = useCallback(
    async (campaignId: Id<"campaigns">) => {
      try {
        const response = await deleteCampaign({ campaignId });
        if (!response.success) {
          toast.error(response.message);
          return false;
        }
        toast.success(response.message);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete campaign"
        );
        return false;
      }
    },
    [deleteCampaign]
  );

  const confirmDelete = useCallback(async () => {
    if (!deletingCampaignId) return;
    const success = await handleDelete(deletingCampaignId);
    if (success) {
      setDeletingCampaignId(null);
    }
  }, [deletingCampaignId, handleDelete]);

  const handleApprove = useCallback(
    async (submissionId: Id<"submissions">) => {
      try {
        const response = await updateSubmissionStatus({
          submissionId,
          status: "approved",
        });
        if (!response.success) {
          toast.error(response.message);
          return false;
        }
        toast.success(response.message);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to approve submission"
        );
        return false;
      }
    },
    [updateSubmissionStatus]
  );

  const handleReject = useCallback(
    async (submissionId: Id<"submissions">, rejectionReason: string) => {
      try {
        const response = await updateSubmissionStatus({
          submissionId,
          status: "rejected",
          rejectionReason,
        });
        if (!response.success) {
          toast.error(response.message);
          return false;
        }
        toast.success(response.message);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to reject submission"
        );
        return false;
      }
    },
    [updateSubmissionStatus]
  );

  const onApprove = useCallback(
    (id: Id<"submissions">) => {
      void handleApprove(id);
    },
    [handleApprove]
  );

  const onReject = useCallback(
    (id: Id<"submissions">, reason: string) => {
      void handleReject(id, reason);
    },
    [handleReject]
  );

  if (brandStats === undefined) {
    return <LoadingSpinner />;
  }

  if (!brandStats) {
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
        <h1 className="text-3xl font-bold">Brand Dashboard</h1>
        {/* <Button onClick={() => setShowCreateModal(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Campaign
        </Button> */}
      </div>

      <BrandStats
        stats={brandStats.stats}
        activeCampaignsCount={brandStats.activeCampaigns.length}
      />

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignList
            activeCampaigns={brandStats.activeCampaigns}
            draftCampaigns={brandStats.draftCampaigns}
            completedCampaigns={brandStats.completedCampaigns}
            onEdit={onCampaignEdit}
            onDelete={onCampaignDelete}
          />
        </TabsContent>

        <TabsContent value="submissions">
          <SubmissionsList
            pendingSubmissions={pendingSubmissions}
            reviewedSubmissions={reviewedSubmissions}
            isLoading={isSubmissionsLoading}
            onApprove={onApprove}
            onReject={onReject}
            userType={userType}
          />
        </TabsContent>
      </Tabs>

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
