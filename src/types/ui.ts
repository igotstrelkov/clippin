import type { Doc } from "../../convex/_generated/dataModel";

// Shared UI types built on top of Convex Doc<T> shapes

// Campaigns shown in the dashboard and editors
export type UICampaign = Doc<"campaigns">;
export type CampaignForEdit = UICampaign;
// Enriched campaign with brand display fields (marketplace, details pages)
export type UICampaignWithBrand = UICampaign & {
  brandName: string;
  brandLogo: string | null;
};

// Submissions enriched for brand/creator UIs
export type UISubmission = Doc<"submissions"> & {
  // Enriched fields added by brand/creator queries
  creatorName: string;
  campaignTitle: string;
  tiktokUsername?: string;
  // Some queries may return `submittedAt`; otherwise use `_creationTime`
  submittedAt?: number;
};

// Creator dashboard often includes brandName alongside UISubmission fields
export type CreatorUISubmission = UISubmission & {
  brandName?: string;
};

// Raw result shape from getCreatorSubmissions (before UI mapping)
export type CreatorQuerySubmission = Doc<"submissions"> & {
  campaignTitle?: string;
  brandName?: string;
};
