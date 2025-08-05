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
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import {
  useBrandDashboard,
  useCampaignActions,
  useSubmissionActions,
} from "../hooks/useBrandDashboard";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { AnalyticsDashboard } from "./dashboard/AnalyticsDashboard";
import { CampaignList } from "./dashboard/CampaignList";
import { CampaignStats } from "./dashboard/CampaignStats";
import { DashboardSkeleton } from "./dashboard/DashboardSkeleton";
import { SubmissionsList } from "./dashboard/SubmissionsList";
import { EditCampaignModal } from "./EditCampaignModal";

export function BrandDashboard() {
  const {
    dashboardData,
    pendingSubmissions,
    reviewedSubmissions,
    profile,
    isLoading,
    hasError,
  } = useBrandDashboard();

  const { handleDelete } = useCampaignActions();
  const { handleApprove, handleReject } = useSubmissionActions();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deletingCampaignId, setDeletingCampaignId] =
    useState<Id<"campaigns"> | null>(null);

  // Show loading or error states
  if (isLoading || hasError) {
    return <DashboardSkeleton isLoading={isLoading} hasError={hasError} />;
  }

  if (!dashboardData) {
    return <DashboardSkeleton isLoading={false} hasError={true} />;
  }

  const { activeCampaigns, draftCampaigns, stats } = dashboardData;

  const onCampaignEdit = (campaign: any) => {
    setEditingCampaign(campaign);
  };

  const onCampaignDelete = (campaignId: Id<"campaigns">) => {
    setDeletingCampaignId(campaignId);
  };

  const confirmDelete = async () => {
    if (!deletingCampaignId) return;
    const success = await handleDelete(deletingCampaignId);
    if (success) {
      setDeletingCampaignId(null);
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
        stats={stats}
        activeCampaignsCount={activeCampaigns.length}
      />

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          {/* <TabsTrigger value="analytics">Analytics</TabsTrigger> */}
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignList
            activeCampaigns={activeCampaigns}
            draftCampaigns={draftCampaigns}
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

        <TabsContent value="analytics">
          <AnalyticsDashboard />
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
