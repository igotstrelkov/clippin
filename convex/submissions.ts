import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { logger } from "./logger";

// Submit to campaign
export const submitToCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    tiktokUrl: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    data: v.optional(v.object({
      submissionId: v.optional(v.id("submissions")),
    })),
    metadata: v.optional(v.object({
      steps: v.optional(v.number()),
      executionTime: v.optional(v.number()),
    })),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }

    // Use workflow orchestrator for complex submission process
    const { executeSubmissionWorkflow } = await import("./lib/workflows/submissionWorkflow");
    
    try {
      const result = await executeSubmissionWorkflow(ctx, userId, {
        campaignId: args.campaignId,
        tiktokUrl: args.tiktokUrl,
      });

      if (result.success) {
        return {
          success: true,
          message: result.data?.message || "Submission successful! Awaiting brand approval.",
          data: {
            submissionId: result.data?.submissionId,
          },
          metadata: {
            steps: result.metadata?.totalSteps,
            executionTime: result.metadata?.executionTime,
          },
        };
      } else {
        return {
          success: false,
          message: result.error || "Submission failed",
          metadata: {
            steps: result.metadata?.totalSteps,
            executionTime: result.metadata?.executionTime,
          },
        };
      }
    } catch (error) {
      logger.error("Submission workflow failed", {
        userId,
        campaignId: args.campaignId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : "Submission failed",
      };
    }
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
          hasReachedThreshold: (s.viewCount || 0) >= 1000,
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
          hasReachedThreshold: (submission.viewCount || 0) >= 1000,
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
  returns: v.object({
    success: v.boolean(),
    data: v.optional(v.object({
      submissionId: v.id("submissions"),
      status: v.string(),
    })),
    message: v.optional(v.string()),
    metadata: v.optional(v.object({
      steps: v.optional(v.number()),
      executionTime: v.optional(v.number()),
    })),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }

    // Use workflow orchestrator for complex approval process
    const { executeApprovalWorkflow } = await import("./lib/workflows/approvalWorkflow");
    
    try {
      const result = await executeApprovalWorkflow(ctx, userId, {
        submissionId: args.submissionId,
        status: args.status,
        rejectionReason: args.rejectionReason,
      });

      if (result.success) {
        return {
          success: true,
          data: {
            submissionId: args.submissionId,
            status: args.status,
          },
          message: result.data?.message || `Submission ${args.status} successfully`,
          metadata: {
            steps: result.metadata?.totalSteps,
            executionTime: result.metadata?.executionTime,
          },
        };
      } else {
        return {
          success: false,
          message: result.error || "Status update failed",
          metadata: {
            steps: result.metadata?.totalSteps,
            executionTime: result.metadata?.executionTime,
          },
        };
      }
    } catch (error) {
      logger.error("Approval workflow failed", {
        userId,
        submissionId: args.submissionId,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : "Status update failed",
      };
    }
  },
});

// Internal mutation to mark threshold as met
export const markThresholdMet = internalMutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      thresholdMetAt: Date.now(),
    });
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
              hasReachedThreshold: (submission.viewCount || 0) >= 1000,
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
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;

    // Find pending submissions older than 48 hours
    const expiredSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("submittedAt"), fortyEightHoursAgo))
      .collect();

    let approvedCount = 0;

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
        try {
          const creator = await ctx.db.get(submission.creatorId);
          const creatorProfile = await ctx.db
            .query("profiles")
            .withIndex("by_user_id", (q) =>
              q.eq("userId", submission.creatorId)
            )
            .unique();

          const brandProfile = await ctx.db
            .query("profiles")
            .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
            .unique();

          if (creator?.email && creatorProfile && brandProfile) {
            await ctx.scheduler.runAfter(
              0,
              internal.emails.sendApprovalNotification,
              {
                creatorEmail: creator.email,
                creatorName: creatorProfile.creatorName || "Creator",
                campaignTitle: campaign.title,
                brandName: brandProfile.companyName || "Brand",
                earnings: 0, // Auto-approved submissions start with 0 earnings
                viewCount: submission.viewCount || 0,
              }
            );
          }
        } catch (emailError) {
          logger.error("Failed to send auto-approval notification email", {
            submissionId: submission._id,
            error:
              emailError instanceof Error
                ? emailError
                : new Error(String(emailError)),
          });
        }
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
