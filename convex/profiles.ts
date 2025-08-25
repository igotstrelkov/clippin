import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { rapidApiClient } from "./lib/rapidApiClient";

// Get current user's profile
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile;
  },
});

// Internal helper to get profile by user ID
export const getProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
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
    userType: v.union(
      v.literal("creator"),
      v.literal("brand"),
      v.literal("admin")
    ),
    // Creator fields
    creatorName: v.optional(v.string()),
    //tiktokUsername: v.optional(v.string()),
    // Brand fields
    companyName: v.optional(v.string()),
    companyLogo: v.optional(v.id("_storage")),
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
      companyName: args.companyName,
      companyLogo: args.companyLogo,
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

// Generic platform-agnostic generation
export const generateCode = mutation({
  args: {
    platform: v.union(
      v.literal("tiktok"),
      v.literal("instagram"),
      v.literal("youtube")
    ),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    return generateCodeForPlatform(ctx, args.platform, args.username);
  },
});

// Generic bio verification mutation
export const verifyBio = mutation({
  args: {
    platform: v.union(
      v.literal("tiktok"),
      v.literal("instagram"),
      v.literal("youtube")
    ),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    return verifyBioForPlatform(ctx, args.platform, args.username);
  },
});

// Internal action to perform the actual TikTok verification
export const completeTikTokVerification = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
    verificationCode: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    try {
      // Call the TikTok verification API
      const verificationResult = await rapidApiClient.verifyBio(
        "tiktok",
        args.username,
        args.verificationCode
      );

      // Update the profile with the verification result
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: verificationResult.found,
        error: verificationResult.error,

        field: "tiktokVerified",
      });
    } catch {
      // Update profile with error
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: false,
        error:
          "Verification failed due to an unexpected error. Please try again.",
        field: "tiktokVerified",
      });
    }
  },
});

// Internal action to perform the actual TikTok verification
export const completeInstagramVerification = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
    verificationCode: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    try {
      // Call the TikTok verification API
      const verificationResult = await rapidApiClient.verifyBio(
        "instagram",
        args.username,
        args.verificationCode
      );

      // Update the profile with the verification result
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: verificationResult.found,
        error: verificationResult.error,

        field: "instagramVerified",
      });
    } catch {
      // Update profile with error
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: false,
        error:
          "Verification failed due to an unexpected error. Please try again.",
        field: "instagramVerified",
      });
    }
  },
});

// Internal action to perform the actual YouTube verification
export const completeYoutubeVerification = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
    verificationCode: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    try {
      // Call the YouTube verification API
      const verificationResult = await rapidApiClient.verifyBio(
        "youtube",
        args.username,
        args.verificationCode
      );

      // Update the profile with the verification result
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: verificationResult.found,
        error: verificationResult.error,

        field: "youtubeVerified",
      });
    } catch {
      // Update profile with error
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: false,
        error:
          "Verification failed due to an unexpected error. Please try again.",
        field: "instagramVerified",
      });
    }
  },
});

// Update profile with verification result
export const updateVerificationResult = internalMutation({
  args: {
    profileId: v.id("profiles"),
    verified: v.boolean(),
    error: v.optional(v.string()),
    field: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.verified) {
      // Mark as verified and clear any previous errors
      await ctx.db.patch(args.profileId, {
        [args.field]: true,
        verificationCode: undefined,
        verificationError: undefined,
      });
    } else {
      // Clear verification code, mark as not verified, and store error message
      await ctx.db.patch(args.profileId, {
        verificationCode: undefined,
        [args.field]: false,
        verificationError: args.error || "Code not found in bio",
      });
    }
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

// Get admin dashboard stats
export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "admin") return null;

    // Get system-wide statistics
    const totalUsers = await ctx.db.query("profiles").collect();
    const totalCampaigns = await ctx.db.query("campaigns").collect();
    const totalSubmissions = await ctx.db.query("submissions").collect();

    const userTypeCounts = {
      creators: totalUsers.filter((u) => u.userType === "creator").length,
      brands: totalUsers.filter((u) => u.userType === "brand").length,
      admins: totalUsers.filter((u) => u.userType === "admin").length,
    };

    const campaignStatusCounts = {
      active: totalCampaigns.filter((c) => c.status === "active").length,
      completed: totalCampaigns.filter((c) => c.status === "completed").length,
      draft: totalCampaigns.filter((c) => c.status === "draft").length,
      paused: totalCampaigns.filter((c) => c.status === "paused").length,
    };

    const submissionStatusCounts = {
      pending: totalSubmissions.filter((s) => s.status === "pending").length,
      approved: totalSubmissions.filter((s) => s.status === "approved").length,
      rejected: totalSubmissions.filter((s) => s.status === "rejected").length,
    };

    return {
      totalUsers: totalUsers.length,
      userTypeCounts,
      totalCampaigns: totalCampaigns.length,
      campaignStatusCounts,
      totalSubmissions: totalSubmissions.length,
      submissionStatusCounts,
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

// Centralized platform meta
type PlatformMeta = {
  usernameField: "tiktokUsername" | "instagramUsername" | "youtubeUsername";
  verifiedField: "tiktokVerified" | "instagramVerified" | "youtubeVerified";
  validate?: (u: string) => boolean;
  validationMessage?: string;
};

const PLATFORM_FIELDS: Record<
  "tiktok" | "instagram" | "youtube",
  PlatformMeta
> = {
  tiktok: {
    usernameField: "tiktokUsername",
    verifiedField: "tiktokVerified",
  },
  instagram: {
    usernameField: "instagramUsername",
    verifiedField: "instagramVerified",
  },
  youtube: {
    usernameField: "youtubeUsername",
    verifiedField: "youtubeVerified",
  },
} as const;

type Platform = keyof typeof PLATFORM_FIELDS;

// Shared implementation used by all mutations above
async function generateCodeForPlatform(
  ctx: MutationCtx,
  platform: Platform,
  username: string
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const meta = PLATFORM_FIELDS[platform];

  const existingProfile = await ctx.db
    .query("profiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  // If user already verified on this platform, prevent regeneration
  if (existingProfile?.[meta.verifiedField] === true) {
    const pretty = platform.charAt(0).toUpperCase() + platform.slice(1);
    throw new Error(`${pretty} account already verified`);
  }

  // Ensure no other verified profile owns this username
  const existingVerified = await ctx.db
    .query("profiles")
    .filter((q) => q.eq(q.field(meta.usernameField), username))
    .filter((q) => q.eq(q.field(meta.verifiedField), true))
    .unique();

  if (existingVerified && existingVerified.userId !== userId) {
    throw new Error(
      `This ${platform} username is already verified by another user`
    );
  }

  const verificationCode = `CLIPPIN${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;

  if (existingProfile) {
    await ctx.db.patch(existingProfile._id, {
      [meta.usernameField]: username,
      verificationCode,
      verificationError: undefined,
    });
  } else {
    await ctx.db.insert("profiles", {
      userId,
      userType: "creator",
      [meta.usernameField]: username,
      verificationCode,
    } as any);
  }

  return { verificationCode };
}

// Shared bio verification flow used by platform-specific and generic mutations
async function verifyBioForPlatform(
  ctx: MutationCtx,
  platform: Platform,
  username: string
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  // Get the user's profile
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  if (!profile) {
    throw new Error("Profile not found");
  }

  if (!profile.verificationCode) {
    return {
      success: false,
      message: "No verification code found. Please generate a code first.",
    };
  }

  const usernameField = PLATFORM_FIELDS[platform].usernameField;
  if ((profile as any)[usernameField] !== username) {
    return {
      success: false,
      message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} username doesn't match the one used to generate the code`,
    };
  }

  // Schedule platform-specific verification action
  if (platform === "tiktok") {
    await ctx.scheduler.runAfter(
      0,
      internal.profiles.completeTikTokVerification,
      {
        userId,
        username,
        verificationCode: profile.verificationCode,
        profileId: profile._id,
      }
    );
  } else if (platform === "instagram") {
    await ctx.scheduler.runAfter(
      0,
      internal.profiles.completeInstagramVerification,
      {
        userId,
        username,
        verificationCode: profile.verificationCode,
        profileId: profile._id,
      }
    );
  } else if (platform === "youtube") {
    await ctx.scheduler.runAfter(
      0,
      internal.profiles.completeYoutubeVerification,
      {
        userId,
        username,
        verificationCode: profile.verificationCode,
        profileId: profile._id,
      }
    );
  }

  return { success: true, message: "Verification started..." };
}
