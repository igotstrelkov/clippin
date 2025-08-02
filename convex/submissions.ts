import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

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
      throw new Error("Only creators can submit to campaigns");
    }

    if (!profile.tiktokVerified) {
      throw new Error("Please verify your TikTok account first");
    }

    // Verify campaign exists and is active
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "active") throw new Error("Campaign is not active");

    // Check if user already submitted to this campaign
    const existingSubmission = await ctx.db
      .query("submissions")
      .withIndex("by_campaign_id", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("creatorId"), userId))
      .first();

    if (existingSubmission) {
      throw new Error("You have already submitted to this campaign");
    }

    // Validate TikTok URL format
    if (!isValidTikTokUrl(args.tiktokUrl.trim())) {
      throw new Error("Please provide a valid TikTok URL");
    }

    // Check if this exact URL was already submitted to any campaign
    const existingUrlSubmission = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("tiktokUrl"), args.tiktokUrl.trim()))
      .first();

    if (existingUrlSubmission) {
      throw new Error(
        "This TikTok video has already been submitted to a campaign"
      );
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
      console.error("Failed to schedule submission notification:", error);
    }

    return submissionId;
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
      submissions.map(async (submission) => {
        const campaign = await ctx.db.get(submission.campaignId);

        // Calculate potential earnings
        const potentialEarnings = campaign
          ? Math.min(
              Math.floor((submission.viewCount || 0) / 1000) *
                (campaign.cpmRate / 100),
              campaign.maxPayoutPerSubmission / 100
            )
          : 0;

        return {
          ...submission,
          campaignTitle: campaign?.title || "Unknown Campaign",
          hasReachedThreshold: (submission.viewCount || 0) >= 1000,
          potentialEarnings,
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

        // Calculate potential earnings
        const potentialEarnings = Math.min(
          Math.floor((submission.viewCount || 0) / 1000) *
            (campaign.cpmRate / 100),
          campaign.maxPayoutPerSubmission / 100
        );

        return {
          ...submission,
          creatorName: creatorProfile?.creatorName || "Unknown Creator",
          tiktokUsername: creatorProfile?.tiktokUsername,
          hasReachedThreshold: (submission.viewCount || 0) >= 1000,
          potentialEarnings,
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
    if (args.status === "approved") {
      if ((submission.viewCount || 0) < 1000) {
        throw new Error(
          "Submission must have at least 1,000 views to be approved"
        );
      }
    }

    const updates: any = {
      status: args.status,
    };

    if (args.status === "approved") {
      updates.approvedAt = Date.now();
      updates.earnings = 0; // Earnings start at 0 and are updated by view tracking

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
      console.error("Failed to send notification email:", error);
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
