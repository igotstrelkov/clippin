import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

describe("View Calculation and Earnings", () => {
  const t = convexTest(schema);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateEarnings function", () => {
    // Extract the pure function for testing
    const calculateEarnings = (
      viewCount: number,
      cpmRate: number,
      maxPayout?: number
    ): number => {
      const cpmInDollars = cpmRate / 100;
      const earningsInDollars = (viewCount / 1000) * cpmInDollars;
      const earningsInCents = Math.round(earningsInDollars * 100);

      return maxPayout ? Math.min(earningsInCents, maxPayout) : earningsInCents;
    };

    test("calculates basic CPM earnings correctly", () => {
      // Test case from docs: 50,000 views at €0.05 CPM = €2.50
      const result = calculateEarnings(50000, 5); // 5 cents CPM
      expect(result).toBe(250); // 250 cents = €2.50
    });

    test("calculates earnings for small view counts", () => {
      const result = calculateEarnings(1000, 10); // 1000 views at €0.10 CPM
      expect(result).toBe(10); // 10 cents = €0.10 (1K views × €0.10/1K = €0.10)
    });

    test("calculates earnings for large view counts", () => {
      const result = calculateEarnings(1000000, 5); // 1M views at €0.05 CPM
      expect(result).toBe(5000); // 5000 cents = €50.00
    });

    test("applies maximum payout limit correctly", () => {
      const result = calculateEarnings(100000, 10, 500); // Would be €10.00, but max €5.00
      expect(result).toBe(500); // Limited to 500 cents = €5.00
    });

    test("handles zero views", () => {
      const result = calculateEarnings(0, 5);
      expect(result).toBe(0);
    });

    test("handles fractional earnings correctly", () => {
      const result = calculateEarnings(1500, 3); // 1.5K views at €0.03 CPM = €0.045
      expect(result).toBe(5); // Rounded to 5 cents
    });

    test("handles very small CPM rates", () => {
      const result = calculateEarnings(10000, 1); // 10K views at €0.01 CPM = €0.10
      expect(result).toBe(10); // 10 cents
    });
  });

  describe("View tracking and earnings integration", () => {
    test("creates campaign and submission with initial state", async () => {
      // Set up test data
      const brandUserId = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "brand@test.com",
          name: "Test Brand",
        });

        await ctx.db.insert("profiles", {
          userId,
          userType: "brand",
          companyName: "Test Company",
        });

        return userId;
      });

      const creatorUserId = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "creator@test.com",
          name: "Test Creator",
        });

        await ctx.db.insert("profiles", {
          userId,
          userType: "creator",
          creatorName: "TestCreator",
          tiktokUsername: "@testcreator",
          totalEarnings: 0,
        });

        return userId;
      });

      // Create campaign
      const campaignId = await t.run(async (ctx) => {
        return await ctx.db.insert("campaigns", {
          brandId: brandUserId,
          title: "Test Campaign",
          description: "Test description",
          category: "lifestyle",
          totalBudget: 10000, // €100.00
          remainingBudget: 10000,
          cpmRate: 5, // €0.05 per 1000 views
          maxPayoutPerSubmission: 2500, // €25.00 max
          status: "active",
          assetLinks: [],
          requirements: [],
        });
      });

      // Create submission
      const submissionId = await t.run(async (ctx) => {
        return await ctx.db.insert("submissions", {
          campaignId,
          creatorId: creatorUserId,
          contentUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 0,
          earnings: 0,
          submittedAt: Date.now(),
          platform: "tiktok",
        });
      });

      // Verify initial state
      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      expect(submission).toMatchObject({
        viewCount: 0,
        earnings: 0,
        status: "approved",
      });
    });

    test("updates earnings when view count increases", async () => {
      // Set up campaign and submission
      const { campaignId, submissionId, creatorUserId } = await t.run(
        async (ctx) => {
          const brandUserId = await ctx.db.insert("users", {
            email: "brand@test.com",
            name: "Test Brand",
          });

          await ctx.db.insert("profiles", {
            userId: brandUserId,
            userType: "brand",
            companyName: "Test Company",
          });

          const creatorUserId = await ctx.db.insert("users", {
            email: "creator@test.com",
            name: "Test Creator",
          });

          await ctx.db.insert("profiles", {
            userId: creatorUserId,
            userType: "creator",
            creatorName: "TestCreator",
            totalEarnings: 0,
          });

          const campaignId = await ctx.db.insert("campaigns", {
            brandId: brandUserId,
            title: "Test Campaign",
            description: "Test description",
            category: "lifestyle",
            totalBudget: 10000, // €100.00
            remainingBudget: 10000,
            cpmRate: 5, // €0.05 per 1000 views
            maxPayoutPerSubmission: 5000, // €50.00 max
            status: "active",
            assetLinks: [],
            requirements: [],
          });

          const submissionId = await ctx.db.insert("submissions", {
            campaignId,
            creatorId: creatorUserId,
            contentUrl: "https://www.tiktok.com/@testuser/video/1234567890",
            status: "approved",
            viewCount: 0,
            earnings: 0,
            submittedAt: Date.now(),
            platform: "tiktok",
          });

          return { campaignId, submissionId, creatorUserId };
        }
      );

      // Update view count to 10,000 views
      await t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
        submissionId,
        viewCount: 10000,
        previousViews: 0,
      });

      // Check updated earnings
      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      const campaign = await t.run(async (ctx) => {
        return await ctx.db.get(campaignId);
      });

      const creatorProfile = await t.run(async (ctx) => {
        return await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", creatorUserId))
          .unique();
      });

      // Verify calculations
      expect(submission?.earnings).toBe(50); // 10K views × €0.05/1K = €0.50 = 50 cents
      expect(submission?.viewCount).toBe(10000);
      expect(campaign?.remainingBudget).toBe(9950); // €100.00 - €0.50 = €99.50
      expect(creatorProfile?.totalEarnings).toBe(50);
    });

    test("applies maximum payout limits correctly", async () => {
      const { submissionId, campaignId } = await t.run(async (ctx) => {
        const brandUserId = await ctx.db.insert("users", {
          email: "brand@test.com",
          name: "Test Brand",
        });

        await ctx.db.insert("profiles", {
          userId: brandUserId,
          userType: "brand",
          companyName: "Test Company",
        });

        const creatorUserId = await ctx.db.insert("users", {
          email: "creator@test.com",
          name: "Test Creator",
        });

        await ctx.db.insert("profiles", {
          userId: creatorUserId,
          userType: "creator",
          totalEarnings: 0,
        });

        const campaignId = await ctx.db.insert("campaigns", {
          brandId: brandUserId,
          title: "Test Campaign",
          description: "Test description",
          category: "lifestyle",
          totalBudget: 10000, // €100.00
          remainingBudget: 10000,
          cpmRate: 10, // €0.10 per 1000 views
          maxPayoutPerSubmission: 500, // €5.00 max
          status: "active",
          assetLinks: [],
          requirements: [],
        });

        const submissionId = await ctx.db.insert("submissions", {
          campaignId,
          creatorId: creatorUserId,
          contentUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 0,
          earnings: 0,
          submittedAt: Date.now(),
          platform: "tiktok",
        });

        return { submissionId, campaignId };
      });

      // Update to 100K views (would normally earn €10.00, but max is €5.00)
      await t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
        submissionId,
        viewCount: 100000,
        previousViews: 0,
      });

      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      const campaign = await t.run(async (ctx) => {
        return await ctx.db.get(campaignId);
      });

      // Should be limited to max payout
      expect(submission?.earnings).toBe(500); // Limited to €5.00 = 500 cents
      expect(campaign?.remainingBudget).toBe(9500); // €100.00 - €5.00 = €95.00
    });

    test("completes campaign when budget is exhausted", async () => {
      const { submissionId, campaignId } = await t.run(async (ctx) => {
        const brandUserId = await ctx.db.insert("users", {
          email: "brand@test.com",
          name: "Test Brand",
        });

        await ctx.db.insert("profiles", {
          userId: brandUserId,
          userType: "brand",
          companyName: "Test Company",
        });

        const creatorUserId = await ctx.db.insert("users", {
          email: "creator@test.com",
          name: "Test Creator",
        });

        await ctx.db.insert("profiles", {
          userId: creatorUserId,
          userType: "creator",
          totalEarnings: 0,
        });

        const campaignId = await ctx.db.insert("campaigns", {
          brandId: brandUserId,
          title: "Test Campaign",
          description: "Test description",
          category: "lifestyle",
          totalBudget: 100, // €1.00
          remainingBudget: 100,
          cpmRate: 10, // €0.10 per 1000 views
          maxPayoutPerSubmission: 2000, // €20.00 max (higher than budget)
          status: "active",
          assetLinks: [],
          requirements: [],
        });

        const submissionId = await ctx.db.insert("submissions", {
          campaignId,
          creatorId: creatorUserId,
          contentUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 0,
          earnings: 0,
          submittedAt: Date.now(),
          platform: "tiktok",
        });

        return { submissionId, campaignId };
      });

      // Update to 10K views (would earn €1.00, exactly the budget)
      await t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
        submissionId,
        viewCount: 10000,
        previousViews: 0,
      });

      const campaign = await t.run(async (ctx) => {
        return await ctx.db.get(campaignId);
      });

      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      // Campaign should be completed and budget exhausted
      expect(submission?.earnings).toBe(100); // €1.00 = 100 cents
      expect(campaign?.status).toBe("completed");
      expect(campaign?.remainingBudget).toBe(0);
    });

    test("marks threshold when submission reaches 1000 views", async () => {
      const { submissionId } = await t.run(async (ctx) => {
        const brandUserId = await ctx.db.insert("users", {
          email: "brand@test.com",
          name: "Test Brand",
        });

        await ctx.db.insert("profiles", {
          userId: brandUserId,
          userType: "brand",
          companyName: "Test Company",
        });

        const creatorUserId = await ctx.db.insert("users", {
          email: "creator@test.com",
          name: "Test Creator",
        });

        await ctx.db.insert("profiles", {
          userId: creatorUserId,
          userType: "creator",
          totalEarnings: 0,
        });

        const campaignId = await ctx.db.insert("campaigns", {
          brandId: brandUserId,
          title: "Test Campaign",
          description: "Test description",
          category: "lifestyle",
          totalBudget: 10000,
          remainingBudget: 10000,
          cpmRate: 5,
          maxPayoutPerSubmission: 5000,
          status: "active",
          assetLinks: [],
          requirements: [],
        });

        const submissionId = await ctx.db.insert("submissions", {
          campaignId,
          creatorId: creatorUserId,
          contentUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "pending", // Start as pending
          viewCount: 500, // Below threshold
          submittedAt: Date.now(),
          platform: "tiktok",
        });

        return { submissionId };
      });

      // Update to cross 1000 view threshold
      await t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
        submissionId,
        viewCount: 1500,
        previousViews: 500,
      });

      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      // Should have threshold timestamp set
      expect(submission?.thresholdMetAt).toBeDefined();
      expect(submission?.thresholdMetAt).toBeGreaterThan(0);
    });
  });
});
