import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Create a draft campaign (before payment)
export const createDraftCampaign = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    totalBudget: v.number(),
    cpmRate: v.number(),
    maxPayoutPerSubmission: v.number(),
    endDate: v.optional(v.number()),
    assetLinks: v.array(v.string()),
    requirements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user is a brand
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "brand") {
      throw new Error("Only brands can create campaigns");
    }

    // Validate campaign data
    if (args.totalBudget < 5000) {
      // Minimum $50
      throw new Error("Minimum campaign budget is $50");
    }

    if (args.cpmRate < 100) {
      // Minimum $1 CPM
      throw new Error("Minimum CPM rate is $1.00");
    }

    if (args.maxPayoutPerSubmission > args.totalBudget) {
      throw new Error("Max payout per submission cannot exceed total budget");
    }

    // Create draft campaign
    const campaignId = await ctx.db.insert("campaigns", {
      brandId: userId,
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
      status: "draft", // Start as draft until payment is completed
      totalViews: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      paymentStatus: "pending",
    });

    return campaignId;
  },
});

// Activate campaign after successful payment
export const activateCampaign = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Update campaign status to active
    await ctx.db.patch(args.campaignId, {
      status: "active",
      paymentStatus: "paid",
      stripePaymentIntentId: args.paymentIntentId,
    });

    return campaign;
  },
});

// Get campaigns for brand dashboard
export const getBrandCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_brand_id", (q) => q.eq("brandId", userId))
      .order("desc")
      .collect();

    return campaigns;
  },
});

// Get active campaigns for marketplace
export const getActiveCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();

    // Get brand info for each campaign
    const campaignsWithBrands = await Promise.all(
      campaigns.map(async (campaign) => {
        const brandProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
          .unique();

        // Get logo URL if available
        let logoUrl = null;
        if (brandProfile?.companyLogo) {
          logoUrl = await ctx.storage.getUrl(brandProfile.companyLogo);
        }

        return {
          ...campaign,
          brandName: brandProfile?.companyName || "Unknown Brand",
          brandLogo: logoUrl,
        };
      })
    );

    return campaignsWithBrands;
  },
});

// Get single campaign details
export const getCampaign = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;

    const brandProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
      .unique();

    // Get logo URL if available
    let logoUrl = null;
    if (brandProfile?.companyLogo) {
      logoUrl = await ctx.storage.getUrl(brandProfile.companyLogo);
    }

    return {
      ...campaign,
      brandName: brandProfile?.companyName || "Unknown Brand",
      brandLogo: logoUrl,
    };
  },
});

// Update campaign
export const updateCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    endDate: v.optional(v.number()),
    assetLinks: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("completed"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.brandId !== userId) {
      throw new Error("Not authorized to update this campaign");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.assetLinks !== undefined) updates.assetLinks = args.assetLinks;
    if (args.requirements !== undefined)
      updates.requirements = args.requirements;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.campaignId, updates);
    return campaign;
  },
});

// Delete campaign (only if no submissions)
export const deleteCampaign = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.brandId !== userId) {
      throw new Error("Not authorized to delete this campaign");
    }

    // Check if campaign has submissions
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_campaign_id", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    if (submissions.length > 0) {
      return { success: false, message: "Campaign has existing submissions" };
    }

    await ctx.db.delete(args.campaignId);
    return { success: true, message: "Campaign deleted" };
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

// Get brand dashboard stats (optimized for dashboard)
export const getBrandStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get all campaigns for this brand
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_brand_id", (q) => q.eq("brandId", userId))
      .collect();

    // Separate active and draft campaigns
    const activeCampaigns = campaigns.filter(
      (c) => c.status === "active" || c.status === "paused"
    );
    const draftCampaigns = campaigns.filter((c) => c.status === "draft");

    const completedCampaigns = campaigns.filter(
      (c) => c.status === "completed"
    );

    // Calculate aggregated stats
    const totalSpent = campaigns.reduce(
      (sum, c) => sum + (c.totalBudget - c.remainingBudget),
      0
    );
    const totalViews = campaigns.reduce(
      (sum, c) => sum + (c.totalViews || 0),
      0
    );
    const totalSubmissions = campaigns.reduce(
      (sum, c) => sum + (c.totalSubmissions || 0),
      0
    );
    const avgCpm = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;

    return {
      activeCampaigns,
      draftCampaigns,
      completedCampaigns,
      stats: {
        totalSpent,
        totalViews,
        totalSubmissions,
        avgCpm,
      },
    };
  },
});

// Get marketplace stats (optimized for marketplace)
export const getMarketplaceStats = query({
  args: {},
  handler: async (ctx) => {
    // Get all active campaigns
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();

    // Get brand info for each campaign
    const campaignsWithBrands = await Promise.all(
      campaigns.map(async (campaign) => {
        const brandProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", campaign.brandId))
          .unique();

        // Get logo URL if available
        let logoUrl = null;
        if (brandProfile?.companyLogo) {
          logoUrl = await ctx.storage.getUrl(brandProfile.companyLogo);
        }

        return {
          ...campaign,
          brandName: brandProfile?.companyName || "Unknown Brand",
          brandLogo: logoUrl,
        };
      })
    );

    // Calculate aggregated marketplace stats
    const totalBudget = campaigns.reduce((sum, c) => sum + c.totalBudget, 0);
    const avgCpm =
      campaigns.length > 0
        ? campaigns.reduce((sum, c) => sum + c.cpmRate, 0) / campaigns.length
        : 0;

    return {
      campaigns: campaignsWithBrands,
      stats: {
        totalBudget,
        avgCpm,
        activeCampaignsCount: campaigns.length,
      },
    };
  },
});
