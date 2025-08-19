/**
 * Campaign Service - Pure business logic for campaign management
 * Extracted for improved testability and reusability
 */

import { Doc, Id } from "../_generated/dataModel";
import { validateBudgetConstraints } from "./earnings";

export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface CampaignCreationArgs {
  title: string;
  description: string;
  category: string;
  totalBudget: number;
  cpmRate: number;
  maxPayoutPerSubmission: number;
  endDate?: number;
  assetLinks: string[];
  requirements: string[];
}

export interface CampaignUpdateArgs {
  title?: string;
  description?: string;
  category?: string;
  endDate?: number;
  assetLinks?: string[];
  requirements?: string[];
  status?: Exclude<CampaignStatus, "draft">; // Can't update back to draft
}

export interface CampaignStats {
  totalSpent: number;
  totalViews: number;
  totalSubmissions: number;
  avgCpm: number;
}

/**
 * Validate campaign creation parameters
 */
export function validateCampaignCreation(args: CampaignCreationArgs): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Title validation
  if (!args.title.trim()) {
    errors.push("Campaign title is required");
  }
  if (args.title.trim().length < 3) {
    errors.push("Campaign title must be at least 3 characters");
  }
  if (args.title.trim().length > 100) {
    errors.push("Campaign title must be less than 100 characters");
  }

  // Description validation
  if (!args.description.trim()) {
    errors.push("Campaign description is required");
  }
  if (args.description.trim().length < 10) {
    errors.push("Campaign description must be at least 10 characters");
  }

  // Category validation
  const validCategories = [
    "lifestyle",
    "tech",
    "beauty",
    "fitness",
    "food",
    "travel",
    "fashion",
    "gaming",
  ];
  if (!validCategories.includes(args.category)) {
    errors.push("Invalid campaign category");
  }

  // End date validation
  if (args.endDate && args.endDate <= Date.now()) {
    errors.push("Campaign end date must be in the future");
  }

  // Budget validation
  const budgetValidation = validateBudgetConstraints(
    args.totalBudget,
    args.cpmRate,
    args.maxPayoutPerSubmission
  );
  errors.push(...budgetValidation.errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate campaign update parameters
 */
export function validateCampaignUpdate(
  currentCampaign: Doc<"campaigns">,
  args: CampaignUpdateArgs
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Title validation (if provided)
  if (args.title !== undefined) {
    if (!args.title.trim()) {
      errors.push("Campaign title cannot be empty");
    }
    if (args.title.trim().length < 3) {
      errors.push("Campaign title must be at least 3 characters");
    }
    if (args.title.trim().length > 100) {
      errors.push("Campaign title must be less than 100 characters");
    }
  }

  // Description validation (if provided)
  if (args.description !== undefined) {
    if (!args.description.trim()) {
      errors.push("Campaign description cannot be empty");
    }
    if (args.description.trim().length < 10) {
      errors.push("Campaign description must be at least 10 characters");
    }
  }

  // Category validation (if provided)
  if (args.category !== undefined) {
    const validCategories = [
      "lifestyle",
      "tech",
      "beauty",
      "fitness",
      "food",
      "travel",
      "fashion",
      "gaming",
    ];
    if (!validCategories.includes(args.category)) {
      errors.push("Invalid campaign category");
    }
  }

  // End date validation (if provided)
  if (args.endDate !== undefined && args.endDate <= Date.now()) {
    errors.push("Campaign end date must be in the future");
  }

  // Status transition validation
  if (args.status !== undefined) {
    const transition = validateStatusTransition(
      currentCampaign.status,
      args.status
    );
    if (!transition.isValid) {
      errors.push(transition.error || "Invalid status transition");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate campaign status transitions
 */
export function validateStatusTransition(
  fromStatus: CampaignStatus,
  toStatus: CampaignStatus
): { isValid: boolean; error?: string } {
  const validTransitions: Record<CampaignStatus, CampaignStatus[]> = {
    draft: ["active"], // Draft can only go to active (via payment)
    active: ["paused", "completed"], // Active can be paused or completed
    paused: ["active", "completed"], // Paused can be resumed or completed
    completed: [], // Completed is final state
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
 * Check if campaign can accept new submissions
 */
export function validateCampaignAcceptance(campaign: Doc<"campaigns">): {
  canAccept: boolean;
  reason?: string;
} {
  if (campaign.status !== "active") {
    return {
      canAccept: false,
      reason: `Campaign is ${campaign?.status}`,
    };
  }

  if (campaign?.remainingBudget <= 0) {
    return {
      canAccept: false,
      reason: "Campaign budget exhausted",
    };
  }

  if (campaign?.endDate && campaign?.endDate <= Date.now()) {
    return {
      canAccept: false,
      reason: "Campaign has ended",
    };
  }

  return { canAccept: true };
}

/**
 * Check if campaign can be deleted
 */
export function canDeleteCampaign(
  campaign: Doc<"campaigns">,
  hasSubmissions: boolean
): { canDelete: boolean; reason?: string } {
  if (hasSubmissions) {
    return {
      canDelete: false,
      reason: "Campaign has existing submissions",
    };
  }

  if (campaign.status === "active") {
    return {
      canDelete: false,
      reason: "Cannot delete active campaign",
    };
  }

  if (campaign.status === "completed") {
    return {
      canDelete: false,
      reason: "Cannot delete completed campaign",
    };
  }

  return { canDelete: true };
}

/**
 * Calculate campaign statistics
 */
export function calculateCampaignStats(
  campaigns: Doc<"campaigns">[]
): CampaignStats {
  const totalSpent = campaigns.reduce(
    (sum, c) => sum + (c.totalBudget - c.remainingBudget),
    0
  );

  const totalViews = campaigns.reduce((sum, c) => sum + (c.totalViews || 0), 0);

  const totalSubmissions = campaigns.reduce(
    (sum, c) => sum + (c.totalSubmissions || 0),
    0
  );

  const avgCpm = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;

  return {
    totalSpent,
    totalViews,
    totalSubmissions,
    avgCpm,
  };
}

/**
 * Prepare campaign data for creation
 */
export function prepareCampaignCreation(
  brandId: Id<"users">,
  args: CampaignCreationArgs
): Omit<Doc<"campaigns">, "_id" | "_creationTime"> {
  return {
    brandId,
    title: args.title.trim(),
    description: args.description.trim(),
    category: args.category,
    totalBudget: args.totalBudget,
    remainingBudget: args.totalBudget,
    cpmRate: args.cpmRate,
    maxPayoutPerSubmission: args.maxPayoutPerSubmission,
    endDate: args.endDate,
    assetLinks: args.assetLinks,
    requirements: args.requirements.filter((req) => req.trim().length > 0),
    status: "draft" as const,
    totalViews: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    paymentStatus: "pending" as const,
  };
}

/**
 * Prepare campaign data for updates
 */
export function prepareCampaignUpdate(
  args: CampaignUpdateArgs
): Partial<Doc<"campaigns">> {
  const updates: Partial<Doc<"campaigns">> = {};

  if (args.title !== undefined) updates.title = args.title.trim();
  if (args.description !== undefined)
    updates.description = args.description.trim();
  if (args.category !== undefined) updates.category = args.category;
  if (args.endDate !== undefined) updates.endDate = args.endDate;
  if (args.assetLinks !== undefined) updates.assetLinks = args.assetLinks;
  if (args.requirements !== undefined) {
    updates.requirements = args.requirements.filter(
      (req) => req.trim().length > 0
    );
  }
  if (args.status !== undefined) updates.status = args.status;

  return updates;
}

/**
 * Check if campaign has expired based on end date
 */
export function isCampaignExpired(campaign: Doc<"campaigns">): boolean {
  return Boolean(campaign.endDate && campaign.endDate <= Date.now());
}

/**
 * Get campaigns that should be automatically paused due to expiration
 */
export function findExpiredActiveCampaigns(
  campaigns: Doc<"campaigns">[]
): Doc<"campaigns">[] {
  return campaigns.filter(
    (campaign) => campaign.status === "active" && isCampaignExpired(campaign)
  );
}

/**
 * Group campaigns by status for dashboard display
 */
export function groupCampaignsByStatus(campaigns: Doc<"campaigns">[]) {
  return {
    active: campaigns.filter(
      (c) => c.status === "active" || c.status === "paused"
    ),
    draft: campaigns.filter((c) => c.status === "draft"),
    completed: campaigns.filter((c) => c.status === "completed"),
  };
}
