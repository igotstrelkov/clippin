/**
 * Submission Service - Pure business logic for submission management
 * Extracted for improved testability and reusability
 */

import { Doc, Id } from "../_generated/dataModel";
import { calculateEarnings } from "./earnings";

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "verifying_owner";

export interface SubmissionCreationArgs {
  campaignId: Id<"campaigns">;
  creatorId: Id<"users">;
  contentUrl: string;
  platform: "tiktok" | "instagram";
}

export interface SubmissionUpdateArgs {
  status?: SubmissionStatus;
  rejectionReason?: string;
  viewCount?: number;
  earnings?: number;
  paidOutAmount?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PermissionResult {
  hasPermission: boolean;
  reason?: string;
}

/**
 * Validate content URL format for supported platforms
 */
export function isValidContentUrl(url: string): boolean {
  const tiktokPatterns = [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
  ];

  const instagramPatterns = [
    /^https?:\/\/(www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+/,
    /^https?:\/\/(www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+/,
    /^https?:\/\/(www\.)?instagram\.com\/tv\/[A-Za-z0-9_-]+/,
  ];

  const allPatterns = [...tiktokPatterns, ...instagramPatterns];
  return allPatterns.some((pattern) => pattern.test(url));
}

/**
 * Validate if creator can submit to campaign
 */
export function validateEligibility(
  profile: Doc<"profiles"> | null,
  platform: "tiktok" | "instagram"
): ValidationResult {
  const errors: string[] = [];

  if (!profile) {
    errors.push("Creator profile not found");
    return { isValid: false, errors };
  }

  if (profile.userType !== "creator") {
    errors.push("Only creators can submit to campaigns");
  }

  if (platform === "tiktok" && !profile.tiktokVerified) {
    errors.push("Please verify your TikTok account first");
  }

  if (platform === "instagram" && !profile.instagramVerified) {
    errors.push("Please verify your Instagram account first");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate submission data
 */
export function validateSubmissionData(
  args: SubmissionCreationArgs
): ValidationResult {
  const errors: string[] = [];

  // Validate content URL
  const trimmedUrl = args.contentUrl.trim();
  if (!trimmedUrl) {
    errors.push("Content URL is required");
  } else if (!isValidContentUrl(trimmedUrl)) {
    errors.push("Please provide a valid TikTok or Instagram URL");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if URL was already submitted (business rule)
 */
export function checkUrlDuplication(
  contentUrl: string,
  existingSubmission: Doc<"submissions"> | null
): ValidationResult {
  if (existingSubmission) {
    return {
      isValid: false,
      errors: ["This TikTok video has already been submitted to a campaign"],
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validate submission status transitions
 */
export function validateStatusTransition(
  fromStatus: SubmissionStatus,
  toStatus: SubmissionStatus
): { isValid: boolean; error?: string } {
  const validTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
    pending: ["approved", "rejected"], // Pending can be approved or rejected
    approved: [], // Approved is final (could add "revoked" in future)
    rejected: [], // Rejected is final (could add "reconsidered" in future)
    verifying_owner: [], // Verifying owner can be approved or rejected after verification
  };

  const allowedTransitions = validTransitions[fromStatus];

  if (!allowedTransitions.includes(toStatus)) {
    return {
      isValid: false,
      error: `Invalid status transition from ${fromStatus} to ${toStatus}`,
    };
  }

  return { isValid: true };
}

/**
 * Check if user can update submission status
 */
export function canUpdateSubmissionStatus(
  submission: Doc<"submissions">,
  campaign: Doc<"campaigns">,
  userId: Id<"users">
): PermissionResult {
  if (campaign.brandId !== userId) {
    return {
      hasPermission: false,
      reason: "Only the campaign owner can update submission status",
    };
  }

  if (submission.status !== "pending") {
    return {
      hasPermission: false,
      reason: `Cannot update submission with status: ${submission.status}`,
    };
  }

  return { hasPermission: true };
}

/**
 * Check if submission is eligible for auto-approval
 */
export function isSubmissionEligibleForAutoApproval(
  submission: Doc<"submissions">,
  hoursThreshold: number = 48
): boolean {
  const thresholdTime = Date.now() - hoursThreshold * 60 * 60 * 1000;

  return (
    submission.status === "pending" && submission.submittedAt < thresholdTime
  );
}

/**
 * Calculate submission earnings based on current view count
 */
export function calculateSubmissionEarnings(
  submission: Doc<"submissions">,
  campaign: Doc<"campaigns">
): number {
  if (submission.status !== "approved") {
    return 0;
  }

  const viewCount = submission.viewCount || 0;
  const cpmRate = campaign.cpmRate;
  const maxPayout = campaign.maxPayoutPerSubmission;

  return calculateEarnings(viewCount, cpmRate, maxPayout);
}

/**
 * Prepare submission data for creation
 */
export function prepareSubmissionCreation(
  args: SubmissionCreationArgs
): Omit<Doc<"submissions">, "_id" | "_creationTime"> {
  return {
    campaignId: args.campaignId,
    creatorId: args.creatorId,
    contentUrl: args.contentUrl.trim(),
    status: "verifying_owner",
    viewCount: 0,
    submittedAt: Date.now(),
    platform: args.platform,
  };
}

/**
 * Prepare submission data for status updates
 */
export function prepareSubmissionUpdate(
  args: SubmissionUpdateArgs,
  currentStatus?: SubmissionStatus
): Partial<Doc<"submissions">> {
  const updates: Partial<Doc<"submissions">> = {};

  if (args.status !== undefined) {
    updates.status = args.status;

    if (args.status === "approved") {
      updates.approvedAt = Date.now();
    }
  }

  if (args.rejectionReason !== undefined && currentStatus === "rejected") {
    updates.rejectionReason = args.rejectionReason;
  }

  if (args.viewCount !== undefined) {
    updates.viewCount = args.viewCount;
  }

  if (args.earnings !== undefined) {
    updates.earnings = args.earnings;
  }

  if (args.paidOutAmount !== undefined) {
    updates.paidOutAmount = args.paidOutAmount;
  }

  return updates;
}

/**
 * Calculate stats for a collection of submissions
 */
export function calculateSubmissionStats(submissions: Doc<"submissions">[]): {
  totalSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  pendingSubmissions: number;
  totalViews: number;
  totalEarnings: number;
  avgViewsPerSubmission: number;
} {
  const totalSubmissions = submissions.length;
  const approvedSubmissions = submissions.filter(
    (s) => s.status === "approved"
  ).length;
  const rejectedSubmissions = submissions.filter(
    (s) => s.status === "rejected"
  ).length;
  const pendingSubmissions = submissions.filter(
    (s) => s.status === "pending"
  ).length;

  const totalViews = submissions.reduce(
    (sum, s) => sum + (s.viewCount || 0),
    0
  );
  const totalEarnings = submissions.reduce(
    (sum, s) => sum + (s.earnings || 0),
    0
  );

  const avgViewsPerSubmission =
    totalSubmissions > 0 ? totalViews / totalSubmissions : 0;

  return {
    totalSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    pendingSubmissions,
    totalViews,
    totalEarnings,
    avgViewsPerSubmission,
  };
}

/**
 * Group submissions by status for dashboard display
 */
export function groupSubmissionsByStatus(submissions: Doc<"submissions">[]) {
  return {
    pending: submissions.filter((s) => s.status === "pending"),
    approved: submissions.filter((s) => s.status === "approved"),
    rejected: submissions.filter((s) => s.status === "rejected"),
  };
}

/**
 * Find submissions eligible for auto-approval
 */
export function findExpiredPendingSubmissions(
  submissions: Doc<"submissions">[],
  hoursThreshold: number = 48
): Doc<"submissions">[] {
  return submissions.filter((submission) =>
    isSubmissionEligibleForAutoApproval(submission, hoursThreshold)
  );
}

/**
 * Validate minimum approval requirements (if any future requirements are added)
 */
// export function validateApprovalRequirements(
//   submission: Doc<"submissions">,
//   _campaign: Doc<"campaigns">
// ): ValidationResult {
//   const errors: string[] = [];

//   // Future: Could add minimum view count requirements
//   // if ((submission.viewCount || 0) < 1000) {
//   //   errors.push("Submission must have at least 1,000 views to be approved");
//   // }

//   // Future: Could add other approval criteria

//   return {
//     isValid: errors.length === 0,
//     errors,
//   };
// }
