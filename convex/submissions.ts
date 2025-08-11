import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { logger } from "./logger";
import {
  validateCreatorEligibility,
  validateSubmissionData,
  checkUrlDuplication,
  canUpdateSubmissionStatus,
  validateStatusTransition,
  prepareSubmissionCreation,
  prepareSubmissionUpdate,
  isValidTikTokUrl,
  calculateSubmissionEarnings,
  type SubmissionCreationArgs,
  type SubmissionUpdateArgs,
} from "./lib/submissionService";

// Submit to campaign
export const submitToCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    tiktokUrl: v.string(),
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

    // Validate creator eligibility using service layer
    const eligibilityValidation = validateCreatorEligibility(profile, campaign);
    if (!eligibilityValidation.isValid) {
      return {
        success: false,
        message: eligibilityValidation.errors[0], // Return first error
      };
    }

    // Validate submission data using service layer
    const submissionArgs: SubmissionCreationArgs = {
      campaignId: args.campaignId,
      creatorId: userId,
      tiktokUrl: args.tiktokUrl,
    };
    
    const dataValidation = validateSubmissionData(submissionArgs);
    if (!dataValidation.isValid) {
      return {
        success: false,
        message: dataValidation.errors[0], // Return first error
      };
    }

    // Verify post ownership with TikTok verification
    const isPostVerified = await ctx.runQuery(internal.profiles.verifyPost, {
      postUrl: args.tiktokUrl,
    });

    if (!isPostVerified) {
      return {
        success: false,
        message: "Post does not belong to your verified TikTok account",
      };
    }

    // Check if this exact URL was already submitted to any campaign
    const existingUrlSubmission = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("tiktokUrl"), args.tiktokUrl.trim()))
      .first();

    const duplicationCheck = checkUrlDuplication(args.tiktokUrl, existingUrlSubmission);
    if (!duplicationCheck.isValid) {
      return {
        success: false,
        message: duplicationCheck.errors[0],
      };
    }

    // Prepare submission data using service layer
    const initialViews = 0;
    const submissionData = prepareSubmissionCreation(submissionArgs, initialViews);

    // Create submission
    const submissionId = await ctx.db.insert("submissions", submissionData);

    // Log initial view tracking entry
    if (initialViews > 0) {
      await ctx.db.insert("viewTracking", {
        submissionId,
        viewCount: initialViews,
        timestamp: Date.now(),
        source: "submission_initial",
      });
    }

    // Schedule initial view count fetch
    await ctx.scheduler.runAfter(0, internal.viewTracking.getInitialViewCount, {
      tiktokUrl: args.tiktokUrl.trim(),
      submissionId,
    });

    // Update campaign stats - campaign is guaranteed to exist due to validation
    if (campaign) {
      await ctx.db.patch(args.campaignId, {
        totalSubmissions: (campaign.totalSubmissions || 0) + 1,
      });
    }

    // Update creator's total submissions count - profile is guaranteed to exist due to validation
    if (profile) {
      await ctx.db.patch(profile._id, {
        totalSubmissions: (profile.totalSubmissions || 0) + 1,
      });
    }

    // Send notification to brand (schedule as action)
    try {
      if (campaign) {
        const brandUser = await ctx.db.get(campaign.brandId);
        const brandProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
          .unique();

        if (brandUser?.email && brandProfile?.companyName && profile) {
          await ctx.scheduler.runAfter(
            0,
            internal.emails.sendSubmissionNotification,
            {
              brandEmail: brandUser.email,
              brandName: brandProfile.companyName,
              campaignTitle: campaign.title,
              creatorName: profile.creatorName || "Unknown Creator",
              tiktokUrl: args.tiktokUrl,
            }
          );
        }
      }
    } catch (error) {
      logger.error("Failed to schedule submission notification", {
        submissionId,
        campaignId: campaign?._id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return {
      success: true,
      message: "Submission successful! Awaiting brand approval.",
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
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found");

    const campaign = await ctx.db.get(submission.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    // Validate permissions using service layer
    const permissionCheck = canUpdateSubmissionStatus(submission, campaign, userId);
    if (!permissionCheck.hasPermission) {
      throw new Error(permissionCheck.reason || "Not authorized to update this submission");
    }

    // Validate status transition using service layer
    const transitionValidation = validateStatusTransition(submission.status, args.status);
    if (!transitionValidation.isValid) {
      throw new Error(transitionValidation.error || "Invalid status transition");
    }

    // Prepare updates using service layer
    const updateArgs: SubmissionUpdateArgs = {
      status: args.status,
      rejectionReason: args.rejectionReason,
    };
    
    const updates = prepareSubmissionUpdate(updateArgs, args.status);

    // Update campaign's approved submission count if approving
    if (args.status === "approved") {
      await ctx.db.patch(submission.campaignId, {
        approvedSubmissions: (campaign.approvedSubmissions || 0) + 1,
      });
    }

    await ctx.db.patch(args.submissionId, updates);

    // Send notification email to creator
    try {
      const creator = await ctx.db.get(submission.creatorId);
      const creatorProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("userId", submission.creatorId))
        .unique();

      const brandProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
        .unique();

      if (creator?.email && creatorProfile && brandProfile) {
        if (args.status === "approved") {
          await ctx.scheduler.runAfter(
            0,
            internal.emails.sendApprovalNotification,
            {
              creatorEmail: creator.email,
              creatorName: creatorProfile.creatorName || "Creator",
              campaignTitle: campaign.title,
              brandName: brandProfile.companyName || "Brand",
              earnings: (updates.earnings || 0) / 100,
              viewCount: submission.viewCount || 0,
            }
          );
        } else if (args.status === "rejected" && args.rejectionReason) {
          await ctx.scheduler.runAfter(
            0,
            internal.emails.sendRejectionNotification,
            {
              creatorEmail: creator.email,
              creatorName: creatorProfile.creatorName || "Creator",
              campaignTitle: campaign.title,
              brandName: brandProfile.companyName || "Brand",
              rejectionReason: args.rejectionReason,
              tiktokUrl: submission.tiktokUrl,
            }
          );
        }
      }
    } catch (error) {
      logger.error("Failed to send notification email", {
        submissionId: args.submissionId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return submission;
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
