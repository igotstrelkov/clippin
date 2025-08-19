import type { MutationCtx, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { logger } from "../logger";

export type Ctx = MutationCtx;

// Notify brand when a new submission is made
export async function scheduleBrandSubmissionNotification(
  ctx: Ctx,
  params: { campaign: Doc<"campaigns">; contentUrl: string; creatorName: string }
) {
  try {
    const { campaign } = params;

    const [brandUser, brandProfile] = await Promise.all([
      ctx.db.get(campaign.brandId),
      ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q: any) => q.eq("userId", campaign.brandId))
        .unique(),
    ]);

    if (!brandUser?.email || !brandProfile?.companyName) {
      logger.warn(
        "Skipping submission notification: missing brand email or company name",
        { campaignId: campaign._id }
      );
      return;
    }

    await ctx.scheduler.runAfter(0, internal.emails.sendSubmissionNotification, {
      brandEmail: brandUser.email,
      brandName: brandProfile.companyName,
      campaignTitle: campaign.title,
      creatorName: params.creatorName,
      contentUrl: params.contentUrl,
    });
  } catch (error) {
    logger.error("Failed to schedule submission notification", {
      campaignId: params.campaign._id,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

// Notify creator about approval
export async function scheduleCreatorApprovalNotification(
  ctx: Ctx,
  params: { submission: Doc<"submissions">; campaign: Doc<"campaigns">; earningsCents: number }
) {
  try {
    const { submission, campaign } = params;

    const [creator, creatorProfile, brandProfile] = await Promise.all([
      ctx.db.get(submission.creatorId),
      ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q: any) => q.eq("userId", submission.creatorId))
        .unique(),
      ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q: any) => q.eq("userId", campaign.brandId))
        .unique(),
    ]);

    if (!creator?.email || !creatorProfile || !brandProfile) {
      logger.warn("Skipping approval email: missing creator email or profiles", {
        submissionId: submission._id,
        campaignId: campaign._id,
      });
      return;
    }

    await ctx.scheduler.runAfter(0, internal.emails.sendApprovalNotification, {
      creatorEmail: creator.email,
      creatorName: creatorProfile.creatorName || "Creator",
      campaignTitle: campaign.title,
      brandName: brandProfile.companyName || "Brand",
      earnings: (params.earningsCents || 0) / 100,
      viewCount: submission.viewCount || 0,
    });
  } catch (error) {
    logger.error("Failed to schedule creator approval email", {
      submissionId: params.submission._id,
      campaignId: params.campaign._id,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

// Notify creator about rejection
export async function scheduleCreatorRejectionNotification(
  ctx: Ctx,
  params: { submission: Doc<"submissions">; campaign: Doc<"campaigns">; rejectionReason: string }
) {
  try {
    const { submission, campaign } = params;

    const [creator, creatorProfile, brandProfile] = await Promise.all([
      ctx.db.get(submission.creatorId),
      ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q: any) => q.eq("userId", submission.creatorId))
        .unique(),
      ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q: any) => q.eq("userId", campaign.brandId))
        .unique(),
    ]);

    if (!creator?.email || !creatorProfile || !brandProfile) {
      logger.warn("Skipping rejection email: missing creator email or profiles", {
        submissionId: submission._id,
        campaignId: campaign._id,
      });
      return;
    }

    await ctx.scheduler.runAfter(0, internal.emails.sendRejectionNotification, {
      creatorEmail: creator.email,
      creatorName: creatorProfile.creatorName || "Creator",
      campaignTitle: campaign.title,
      brandName: brandProfile.companyName || "Brand",
      rejectionReason: params.rejectionReason,
      contentUrl: submission.contentUrl,
    });
  } catch (error) {
    logger.error("Failed to schedule creator rejection email", {
      submissionId: params.submission._id,
      campaignId: params.campaign._id,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

// Router for creator emails
export async function sendCreatorEmail(
  ctx: Ctx,
  params:
    | { type: "approved"; submission: Doc<"submissions">; campaign: Doc<"campaigns">; earningsCents?: number }
    | { type: "rejected"; submission: Doc<"submissions">; campaign: Doc<"campaigns">; rejectionReason: string }
) {
  if (params.type === "approved") {
    return scheduleCreatorApprovalNotification(ctx, {
      submission: params.submission,
      campaign: params.campaign,
      earningsCents: params.earningsCents ?? 0,
    });
  }
  return scheduleCreatorRejectionNotification(ctx, {
    submission: params.submission,
    campaign: params.campaign,
    rejectionReason: params.rejectionReason,
  });
}

// Notify creator about payout confirmation (Action context)
export async function schedulePayoutConfirmationEmail(
  ctx: ActionCtx,
  params: {
    creatorEmail: string;
    creatorName: string;
    amount: number;
    transferAmount: number;
    campaignTitles: string[];
    totalSubmissions: number;
  }
) {
  try {
    await ctx.runAction(internal.emails.sendPayoutConfirmation, {
      creatorEmail: params.creatorEmail,
      creatorName: params.creatorName,
      amount: params.amount,
      transferAmount: params.transferAmount,
      campaignTitles: params.campaignTitles,
      totalSubmissions: params.totalSubmissions,
    });
  } catch (error) {
    logger.error("Failed to schedule payout confirmation email", {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
