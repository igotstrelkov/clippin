import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { logger } from "./logger";

// Submit to campaign
export const submitToCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    tiktokUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user is a creator
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "creator") {
      return {
        success: false,
        message: "Only creators can submit to campaigns",
      };
    }

    if (!profile.tiktokVerified) {
      return {
        success: false,
        message: "Please verify your TikTok account first",
      };
    }

    const isPostVerified = await ctx.runQuery(internal.profiles.verifyPost, {
      postUrl: args.tiktokUrl,
    });

    if (!isPostVerified) {
      return {
        success: false,
        message: "Post does not belong to your verified TikTok account",
      };
    }

    // Verify campaign exists and is active
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign)
      return {
        success: false,
        message: "Campaign not found",
      };
    if (campaign.status !== "active")
      return {
        success: false,
        message: "Campaign is not active",
      };

    // Check if user already submitted to this campaign
    // const existingSubmission = await ctx.db
    //   .query("submissions")
    //   .withIndex("by_campaign_id", (q) => q.eq("campaignId", args.campaignId))
    //   .filter((q) => q.eq(q.field("creatorId"), userId))
    //   .first();

    // if (existingSubmission) {
    //   throw new Error("You have already submitted to this campaign");
    // }

    // Validate TikTok URL format
    if (!isValidTikTokUrl(args.tiktokUrl.trim())) {
      return { success: false, message: "Please provide a valid TikTok URL" };
    }

    // Check if this exact URL was already submitted to any campaign
    const existingUrlSubmission = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("tiktokUrl"), args.tiktokUrl.trim()))
      .first();

    if (existingUrlSubmission) {
      return {
        success: false,
        message: "This TikTok video has already been submitted to a campaign",
      };
    }

    // Initial view count will be fetched after submission creation
    const initialViews = 0;

    // Create submission
    const submissionId = await ctx.db.insert("submissions", {
      campaignId: args.campaignId,
      creatorId: userId,
      tiktokUrl: args.tiktokUrl.trim(),
      status: "pending",
      viewCount: initialViews,
      initialViewCount: initialViews,
      submittedAt: Date.now(),
      viewTrackingEnabled: true,
      lastApiCall: 0, // Initialize rate limiting
    });

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

    // Update campaign stats
    const campaignToUpdate = await ctx.db.get(args.campaignId);
    if (campaignToUpdate) {
      await ctx.db.patch(args.campaignId, {
        totalSubmissions: (campaignToUpdate.totalSubmissions || 0) + 1,
      });
    }

    // Update creator's total submissions count
    if (profile) {
      await ctx.db.patch(profile._id, {
        totalSubmissions: (profile.totalSubmissions || 0) + 1,
      });
    }

    // Send notification to brand (schedule as action)
    try {
      const brandUser = await ctx.db.get(campaign.brandId);
      const brandProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
        .unique();

      if (brandUser?.email && brandProfile?.companyName) {
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
    } catch (error) {
      logger.error("Failed to schedule submission notification", {
        submissionId,
        campaignId: campaign._id,
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

    if (campaign.brandId !== userId) {
      throw new Error("Not authorized to update this submission");
    }

    // For approval, check if submission meets minimum requirements
    // if (args.status === "approved") {
    //   if ((submission.viewCount || 0) < 1000) {
    //     throw new Error(
    //       "Submission must have at least 1,000 views to be approved"
    //     );
    //   }
    // }

    const updates: Partial<Doc<"submissions">> = {
      status: args.status,
    };

    if (args.status === "approved") {
      updates.approvedAt = Date.now();

      // Update campaign's approved submission count
      await ctx.db.patch(submission.campaignId, {
        approvedSubmissions: (campaign.approvedSubmissions || 0) + 1,
      });
    } else if (args.status === "rejected" && args.rejectionReason) {
      updates.rejectionReason = args.rejectionReason;
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

// Helper function to validate TikTok URLs
function isValidTikTokUrl(url: string): boolean {
  const tiktokPatterns = [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
  ];

  return tiktokPatterns.some((pattern) => pattern.test(url));
}

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
