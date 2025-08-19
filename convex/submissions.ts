import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { validateCampaignAcceptance } from "./lib/campaigns";
import {
  scheduleBrandSubmissionNotification,
  sendCreatorEmail,
} from "./lib/emailNotifications";
import {
  calculateSubmissionStats,
  canUpdateSubmissionStatus,
  checkUrlDuplication,
  findExpiredPendingSubmissions,
  groupSubmissionsByStatus,
  prepareSubmissionCreation,
  prepareSubmissionUpdate,
  validateProfileEligibility,
  validateStatusTransition,
  validateSubmissionData,
  type SubmissionCreationArgs,
  type SubmissionUpdateArgs,
} from "./lib/submissions";
import { logger } from "./logger";

// Submit to campaign
export const submitToCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    contentUrl: v.string(),
    platform: v.union(v.literal("tiktok"), v.literal("instagram")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    // Get campaign
    const campaign = await ctx.db.get(args.campaignId);

    if (!campaign) {
      return {
        success: false,
        message: "Campaign not found",
      };
    }

    // Validate creator eligibility using service layer
    const { isValid, errors } = validateProfileEligibility(
      profile,
      args.platform
    );
    if (!isValid) {
      return {
        success: false,
        message: errors.join(", "), // Return all errors
      };
    }

    const { canAccept, reason } = validateCampaignAcceptance(campaign);
    if (!canAccept) {
      return {
        success: false,
        message: reason,
      };
    }

    // Validate submission data using service layer
    const submissionArgs: SubmissionCreationArgs = {
      campaignId: args.campaignId,
      creatorId: userId,
      contentUrl: args.contentUrl,
      platform: args.platform,
    };

    const dataValidation = validateSubmissionData(submissionArgs);
    if (!dataValidation.isValid) {
      return {
        success: false,
        message: dataValidation.errors.join(", "), // Return all errors
      };
    }

    // Check if this exact URL was already submitted to any campaign
    const existingUrlSubmission = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("contentUrl"), args.contentUrl.trim()))
      .first();

    const duplicationCheck = checkUrlDuplication(
      args.contentUrl,
      existingUrlSubmission
    );
    if (!duplicationCheck.isValid) {
      return {
        success: false,
        message: duplicationCheck.errors[0],
      };
    }

    // Prepare submission data using service layer

    const submissionData = prepareSubmissionCreation(submissionArgs);

    // Create submission
    const submissionId = await ctx.db.insert("submissions", submissionData);

    // Schedule initial view count fetch and ownership verification
    await ctx.scheduler.runAfter(0, internal.viewTracking.verifyContentOwner, {
      contentUrl: args.contentUrl.trim(),
      submissionId,
      platform: args.platform,
    });

    // Note: Campaign and profile stats will be updated after successful ownership verification
    // in the getViewCount action when isOwner === true

    // Send notification to brand (schedule as action)

    await scheduleBrandSubmissionNotification(ctx, {
      campaign,
      contentUrl: args.contentUrl,
      creatorName: profile?.creatorName || "Unknown Creator",
    });

    return {
      success: true,
      message: "Submitted successfully! Pending approval",
    };
  },
});

// Get creator's submissions
export const getCreatorSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
      .order("desc")
      .collect();

    // Get campaign info for each submission
    const submissionsWithCampaigns = await Promise.all(
      submissions.map(async (s) => {
        const campaign = await ctx.db.get(s.campaignId);
        const brandProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) =>
            q.eq("userId", campaign?.brandId as Id<"users">)
          )
          .unique();

        return {
          ...s,
          campaignTitle: campaign?.title,
          brandName: brandProfile?.companyName,
        };
      })
    );

    return submissionsWithCampaigns;
  },
});

// Get campaign submissions for brand review
export const getCampaignSubmissions = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.brandId !== userId) {
      return [];
    }

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_campaign_id", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .collect();

    // Get creator info for each submission
    const submissionsWithCreators = await Promise.all(
      submissions.map(async (submission) => {
        const creatorProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", submission.creatorId))
          .unique();

        return {
          ...submission,
          creatorName: creatorProfile?.creatorName || "Unknown Creator",
          tiktokUsername: creatorProfile?.tiktokUsername,
        };
      })
    );

    return submissionsWithCreators;
  },
});

// Update submission status (approve/reject)
export const updateSubmissionStatus = mutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    const campaign = await ctx.db.get(submission.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Validate permissions using service layer
    const permissionCheck = canUpdateSubmissionStatus(
      submission,
      campaign,
      userId
    );
    if (!permissionCheck.hasPermission) {
      throw new Error(
        permissionCheck.reason || "Unauthorized to update submission status"
      );
    }

    // Validate status transition using service layer
    const transitionValidation = validateStatusTransition(
      submission.status,
      args.status
    );
    if (!transitionValidation.isValid) {
      throw new Error(
        transitionValidation.error || "Invalid status transition"
      );
    }

    // Prepare updates using service layer
    const updateArgs: SubmissionUpdateArgs = {
      status: args.status,
      rejectionReason: args.rejectionReason,
    };

    const updates = prepareSubmissionUpdate(updateArgs, submission.status);

    // Update campaign's approved submission count if approving
    if (args.status === "approved") {
      await ctx.db.patch(submission.campaignId, {
        approvedSubmissions: (campaign.approvedSubmissions || 0) + 1,
      });
    }

    await ctx.db.patch(args.submissionId, updates);

    // Send notification email to creator
    if (args.status === "approved") {
      await sendCreatorEmail(ctx, {
        type: "approved",
        submission,
        campaign,
        earningsCents: updates.earnings || 0,
      });
    } else if (args.status === "rejected" && args.rejectionReason) {
      await sendCreatorEmail(ctx, {
        type: "rejected",
        submission,
        campaign,
        rejectionReason: args.rejectionReason,
      });
    }

    return submission;
  },
});

// Get all submissions for a brand's campaigns
export const getBrandSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const brandCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_brand_id", (q) => q.eq("brandId", userId))
      .collect();

    if (brandCampaigns.length === 0) {
      return [];
    }

    const allSubmissions = await Promise.all(
      brandCampaigns.map(async (campaign) => {
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_campaign_id", (q) => q.eq("campaignId", campaign._id))
          .order("desc")
          .collect();

        return Promise.all(
          submissions.map(async (submission) => {
            const creatorProfile = await ctx.db
              .query("profiles")
              .withIndex("by_user_id", (q) =>
                q.eq("userId", submission.creatorId)
              )
              .unique();

            return {
              ...submission,
              campaignTitle: campaign.title,
              creatorName: creatorProfile?.creatorName || "Unknown Creator",
              tiktokUsername: creatorProfile?.tiktokUsername,
            };
          })
        );
      })
    );

    return allSubmissions
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

// Auto-approve submissions that have been pending for more than 48 hours
export const autoApproveExpiredSubmissions = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    approved: v.number(),
  }),
  handler: async (ctx) => {
    const HOURS_THRESHOLD = 48;

    // Get all pending submissions
    const pendingSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // Find submissions eligible for auto-approval using service layer utility
    const expiredSubmissions = findExpiredPendingSubmissions(
      pendingSubmissions,
      HOURS_THRESHOLD
    );

    let approvedCount = 0;

    logger.info("Starting auto-approval process", {
      totalProcessed: pendingSubmissions.length,
      processedCount: expiredSubmissions.length,
    });

    for (const submission of expiredSubmissions) {
      try {
        // Get the campaign to update approved submissions count
        const campaign = await ctx.db.get(submission.campaignId);
        if (!campaign) {
          logger.error("Campaign not found for auto-approval", {
            submissionId: submission._id,
            campaignId: submission.campaignId,
          });
          continue;
        }

        // Update submission status to approved
        await ctx.db.patch(submission._id, {
          status: "approved",
          approvedAt: Date.now(),
        });

        // Update campaign's approved submission count
        await ctx.db.patch(submission.campaignId, {
          approvedSubmissions: (campaign.approvedSubmissions || 0) + 1,
        });

        // Log the auto-approval
        logger.info("Submission auto-approved after 48 hours", {
          submissionId: submission._id,
          campaignId: submission.campaignId,
          creatorId: submission.creatorId,
        });

        approvedCount++;

        // Send notification email to creator about auto-approval
        await sendCreatorEmail(ctx, {
          type: "approved",
          submission,
          campaign,
          earningsCents: 0,
        });
      } catch (error) {
        logger.error("Failed to auto-approve submission", {
          submissionId: submission._id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    logger.info("Auto-approval batch completed", {
      totalProcessed: expiredSubmissions.length,
    });

    return {
      processed: expiredSubmissions.length,
      approved: approvedCount,
    };
  },
});

// Internal mutation to update stats after successful ownership verification
export const updateStatsAfterVerification = internalMutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return;

    // Get campaign and profile
    const campaign = await ctx.db.get(submission.campaignId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", submission.creatorId))
      .unique();

    // Update campaign stats
    if (campaign) {
      await ctx.db.patch(submission.campaignId, {
        totalSubmissions: (campaign.totalSubmissions || 0) + 1,
      });
    }

    // Update creator's total submissions count
    if (profile) {
      await ctx.db.patch(profile._id, {
        totalSubmissions: (profile.totalSubmissions || 0) + 1,
      });
    }

    // Update submission status to pending after successful verification
    await ctx.db.patch(args.submissionId, {
      status: "pending" as const,
    });
  },
});

export const rejectSubmission = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      status: "rejected",
      rejectionReason: args.rejectionReason,
    });
  },
});

// Internal query to get a submission by ID
export const getSubmissionById = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.submissionId);
  },
});

// Get submission statistics for dashboard
export const getSubmissionStats = query({
  args: { campaignId: v.optional(v.id("campaigns")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    let submissions: Doc<"submissions">[];

    if (args.campaignId) {
      // Get stats for specific campaign (brand view)
      const campaign = await ctx.db.get(args.campaignId);
      if (!campaign || campaign.brandId !== userId) {
        throw new Error("Unauthorized access to campaign");
      }

      submissions = await ctx.db
        .query("submissions")
        .withIndex("by_campaign_id", (q) =>
          q.eq("campaignId", args.campaignId!)
        )
        .collect();
    } else {
      // Get stats for creator's submissions
      submissions = await ctx.db
        .query("submissions")
        .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
        .collect();
    }

    return calculateSubmissionStats(submissions);
  },
});

// Get submissions grouped by status for dashboard
export const getGroupedSubmissions = query({
  args: { campaignId: v.optional(v.id("campaigns")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    let submissions: Doc<"submissions">[];

    if (args.campaignId) {
      // Get submissions for specific campaign (brand view)
      const campaign = await ctx.db.get(args.campaignId);
      if (!campaign || campaign.brandId !== userId) {
        throw new Error("Unauthorized access to campaign");
      }

      submissions = await ctx.db
        .query("submissions")
        .withIndex("by_campaign_id", (q) =>
          q.eq("campaignId", args.campaignId!)
        )
        .collect();
    } else {
      // Get submissions for creator
      submissions = await ctx.db
        .query("submissions")
        .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
        .collect();
    }

    return groupSubmissionsByStatus(submissions);
  },
});

// Get all active submissions that need view tracking
export const getActiveSubmissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("submissions")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved")
        )
      )
      .collect();
  },
});
