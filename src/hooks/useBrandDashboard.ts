import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function useBrandDashboard() {
  const dashboardData = useQuery(api.campaigns.getBrandDashboardStats);
  const submissions = useQuery(api.submissions.getBrandSubmissions);
  const profile = useQuery(api.profiles.getCurrentProfile);

  const { pendingSubmissions, reviewedSubmissions } = useMemo(() => {
    if (!submissions)
      return { pendingSubmissions: [], reviewedSubmissions: [] };
    const pending = submissions.filter((s) => s.status === "pending");
    const reviewed = submissions.filter((s) => s.status !== "pending");
    return { pendingSubmissions: pending, reviewedSubmissions: reviewed };
  }, [submissions]);

  const isLoading = dashboardData === undefined || submissions === undefined;
  const hasError = dashboardData === null || submissions === null;

  return {
    dashboardData,
    submissions,
    profile,
    pendingSubmissions,
    reviewedSubmissions,
    isLoading,
    hasError,
  };
}

export function useCampaignActions() {
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign);

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

  return { handleDelete };
}

export function useSubmissionActions() {
  const updateSubmissionStatus = useMutation(
    api.submissions.updateSubmissionStatus
  );

  const handleApprove = async (submissionId: Id<"submissions">) => {
    try {
      await updateSubmissionStatus({ submissionId, status: "approved" });
      toast.success("Submission approved successfully");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to approve submission"
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

  return { handleApprove, handleReject };
}
