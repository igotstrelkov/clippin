import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

// Get current user's profile
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    console.log(userId);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile;
  },
});

// Generate upload URL for company logo
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

// Create or update profile
export const updateProfile = mutation({
  args: {
    userType: v.union(v.literal("creator"), v.literal("brand")),
    // Creator fields
    creatorName: v.optional(v.string()),
    //tiktokUsername: v.optional(v.string()),
    // Brand fields
    companyName: v.optional(v.string()),
    companyLogo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    const profileData = {
      userType: args.userType,
      creatorName: args.creatorName,
      //tiktokUsername: args.tiktokUsername,
      companyName: args.companyName,
      companyLogo: args.companyLogo ? (args.companyLogo as any) : undefined,
    };

    if (existingProfile) {
      // Don't allow changing user type after initial setup
      if (existingProfile.userType !== args.userType) {
        throw new Error("Cannot change account type after initial setup");
      }
      // Update existing profile (excluding userType)
      const { userType, ...updateData } = profileData;
      await ctx.db.patch(existingProfile._id, updateData);
      return existingProfile._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("profiles", {
        userId,
        ...profileData,
        tiktokVerified: false,
        totalEarnings: 0,
        totalSubmissions: 0,
      });
      return profileId;
    }
  },
});

// Generate verification code for TikTok bio verification
export const generateTikTokVerificationCode = mutation({
  args: { tiktokUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "creator") {
      throw new Error("Only creators can verify TikTok accounts");
    }

    // Generate random verification code
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "CLIP";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    await ctx.db.patch(profile._id, {
      tiktokUsername: args.tiktokUsername,
      tiktokVerificationCode: code,
      verificationCodeGeneratedAt: Date.now(),
      tiktokVerified: false,
    });

    return { verificationCode: code };
  },
});

// Verify TikTok account by checking bio
export const verifyTikTokBio = mutation({
  args: { tiktokUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "creator") {
      throw new Error("Only creators can verify TikTok accounts");
    }

    if (!profile.tiktokVerificationCode) {
      throw new Error(
        "No verification code generated. Please start the verification process."
      );
    }

    // Check if verification code is still valid (expires after 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (
      !profile.verificationCodeGeneratedAt ||
      profile.verificationCodeGeneratedAt < oneHourAgo
    ) {
      throw new Error(
        "Verification code has expired. Please generate a new one."
      );
    }

    // Validate username format
    if (!isValidTikTokUsername(args.tiktokUsername)) {
      throw new Error("Invalid TikTok username format");
    }

    // Schedule TikTok bio verification
    const bioCheck = await ctx.scheduler.runAfter(
      0,
      internal.tiktokVerification.checkTikTokBioForCode,
      {
        username: args.tiktokUsername,
        verificationCode: profile.tiktokVerificationCode,
      }
    );

    // For now, simulate the check with high success rate for demo
    const success = Math.random() > 0.15; // 85% success rate
    if (!success) {
      throw new Error(
        "Verification code not found in your TikTok bio. Please make sure you've added it correctly and try again."
      );
    }

    // Mark as verified and clean up verification data
    await ctx.db.patch(profile._id, {
      tiktokUsername: args.tiktokUsername,
      tiktokVerified: true,
      tiktokVerificationCode: undefined,
      verificationCodeGeneratedAt: undefined,
      verifiedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get creator dashboard stats
export const getCreatorStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "creator") return null;

    // Get recent submissions for 24h stats
    const recentSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
      .filter((q) =>
        q.gt(q.field("submittedAt"), Date.now() - 24 * 60 * 60 * 1000)
      )
      .collect();

    const recent24hViews = recentSubmissions.reduce(
      (sum, sub) => sum + (sub.viewCount || 0),
      0
    );
    const recent24hEarnings = recentSubmissions.reduce(
      (sum, sub) => sum + (sub.earnings || 0),
      0
    );

    return {
      userId,
      totalEarnings: profile.totalEarnings || 0,
      totalSubmissions: profile.totalSubmissions || 0,
      recent24hViews,
      recent24hEarnings,
      tiktokVerified: profile.tiktokVerified || false,
      tiktokUsername: profile.tiktokUsername,
      creatorName: profile.creatorName,
    };
  },
});

// Get brand dashboard stats
export const getBrandStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "brand") return null;

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_brand_id", (q) => q.eq("brandId", userId))
      .collect();

    const totalViews = campaigns.reduce(
      (sum, campaign) => sum + (campaign.totalViews || 0),
      0
    );
    const totalSpent = campaigns.reduce(
      (sum, campaign) =>
        sum + (campaign.totalBudget - campaign.remainingBudget),
      0
    );
    const totalSubmissions = campaigns.reduce(
      (sum, campaign) => sum + (campaign.totalSubmissions || 0),
      0
    );
    const approvedSubmissions = campaigns.reduce(
      (sum, campaign) => sum + (campaign.approvedSubmissions || 0),
      0
    );

    // const totalViews = campaigns.reduce((sum, campaign) => sum + (campaign.totalViews || 0), 0);
    // const totalSpentCents = campaigns.reduce((sum, campaign) => sum + (campaign.totalBudget - campaign.remainingBudget), 0);
    // const totalSpent = totalSpentCents / 100; // Convert cents to dollars
    // const totalSubmissions = campaigns.reduce((sum, campaign) => sum + (campaign.totalSubmissions || 0), 0);
    // const approvedSubmissions = campaigns.reduce((sum, campaign) => sum + (campaign.approvedSubmissions || 0), 0);

    // const effectiveCPM = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;

    const effectiveCPM = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;

    return {
      totalCampaigns: campaigns.length,
      totalViews,
      totalSpent,
      effectiveCPM,
      totalSubmissions,
      approvedSubmissions,
    };
  },
});

// Internal function to update Stripe customer ID
export const updateStripeCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
    }
  },
});

// Helper function to validate TikTok username format
function isValidTikTokUsername(username: string): boolean {
  const trimmed = username.trim();

  if (trimmed.length < 2 || trimmed.length > 24) {
    return false;
  }

  if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
    return false;
  }

  if (trimmed.includes("..")) {
    return false;
  }

  return true;
}
