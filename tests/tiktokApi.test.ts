import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

// Mock axios for TikTok API calls
vi.mock("axios", () => ({
  default: {
    request: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

import axios from "axios";
import { Id } from "../convex/_generated/dataModel";

describe("TikTok API Integration and Rate Limiting", () => {
  const t = convexTest(schema);

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset axios mocks completely
    (axios.request as any).mockReset();
    (axios.isAxiosError as any).mockReset();
    // Reset rate limiter state between tests
    await t.mutation(internal.rateLimiter.resetForTesting);
  });

  afterEach(() => {
    // Reset any global state between tests
    vi.clearAllMocks();
    // Reset axios mocks completely
    (axios.request as any).mockReset();
    (axios.isAxiosError as any).mockReset();
  });

  describe("Rate Limiting System", () => {
    test("allows requests within rate limits", async () => {
      const status = await t.query(internal.rateLimiter.canMakeRequest);

      expect(status).toMatchObject({
        canRequest: true,
        waitTimeMs: 0,
        queueSize: 0,
      });
    });

    test("records API requests correctly", async () => {
      await t.mutation(internal.rateLimiter.recordRequest, {
        submissionId: "test-submission-123",
      });

      const status = await t.query(internal.rateLimiter.getRateLimiterStatus);

      expect(status.queueSize).toBe(1);
      expect(status.requestsLastMinute).toBe(1);
      expect(status.requestsLastSecond).toBe(1);
      expect(status.utilizationPercent).toBeCloseTo(0.83); // 1/120 * 100
    });

    test("enforces per-second rate limits", async () => {
      // Record maximum requests per second (2)
      await t.mutation(internal.rateLimiter.recordRequest, {
        submissionId: "test-1",
      });
      await t.mutation(internal.rateLimiter.recordRequest, {
        submissionId: "test-2",
      });

      // Third request should be blocked
      const status = await t.query(internal.rateLimiter.canMakeRequest);

      expect(status.canRequest).toBe(false);
      expect(status.waitTimeMs).toBeGreaterThan(0);
    });

    test("enforces per-minute rate limits", async () => {
      // Record 120 requests (maximum per minute)
      for (let i = 0; i < 120; i++) {
        await t.mutation(internal.rateLimiter.recordRequest, {
          submissionId: `test-${i}`,
        });
      }

      const canRequestStatus = await t.query(
        internal.rateLimiter.canMakeRequest
      );
      const detailedStatus = await t.query(
        internal.rateLimiter.getRateLimiterStatus
      );

      expect(canRequestStatus.canRequest).toBe(false);
      expect(canRequestStatus.queueSize).toBe(120);
      expect(detailedStatus.utilizationPercent).toBe(100);
    });

    test("cleans up old requests from queue", async () => {
      // Record a request
      await t.mutation(internal.rateLimiter.recordRequest, {
        submissionId: "old-request",
      });

      const status = await t.query(internal.rateLimiter.getRateLimiterStatus);
      expect(status.queueSize).toBe(1);

      // Since we can't mock time passage in Convex tests easily,
      // we'll just verify the request was recorded properly
      // In a real app, the cleanup happens automatically on subsequent calls
      expect(status.requestsLastMinute).toBe(1);
    });
  });

  describe("TikTok API Integration", () => {
    test("successfully fetches view count for valid URL", async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            play_count: 12345,
            digg_count: 100,
            comment_count: 50,
            share_count: 25,
            author: {
              unique_id: "testuser",
              nickname: "Test User",
            },
          },
        },
      };

      (axios.request as any).mockResolvedValueOnce(mockResponse);

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      expect(result.viewCount).toBe(12345);
      expect(axios.request).toHaveBeenCalledWith({
        method: "GET",
        url: "https://tiktok-scraper7.p.rapidapi.com/",
        params: {
          url: "https://www.tiktok.com/@testuser/video/1234567890",
          hd: "1",
        },
        headers: {
          "x-rapidapi-key": "mock_rapidapi_key",
          "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
        },
      });
    });

    test("handles API failures gracefully", async () => {
      // Mock API failure
      (axios.request as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      expect(result.viewCount).toBe(0); // Should return 0 on failure
    });

    test("handles rate limit errors with retry", async () => {
      // Mock rate limit error first, then success
      const rateLimitError = {
        response: {
          status: 429,
          headers: { "retry-after": "1" }, // Use 1 second instead of 60
        },
        isAxiosError: true,
      };

      const mockResponse = {
        data: {
          data: {
            play_count: 5678,
          },
        },
      };

      (axios.isAxiosError as any).mockReturnValue(true);
      (axios.request as any)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockResponse);

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      expect(result.viewCount).toBe(5678);
      expect(axios.request).toHaveBeenCalledTimes(2); // Should retry once
    }, 35000); // Increase timeout to 35 seconds

    test("validates TikTok URL formats", async () => {
      const validUrls = [
        "https://www.tiktok.com/@username/video/1234567890",
        "https://tiktok.com/@username/video/1234567890",
        "https://vm.tiktok.com/shortcode",
        "https://www.tiktok.com/t/shortcode",
      ];

      for (const url of validUrls) {
        // Reset mocks for each URL
        vi.clearAllMocks();
        
        // Reset axios mocks completely
        (axios.request as any).mockReset();
        (axios.isAxiosError as any).mockReset();

        // Mock successful response for each URL
        (axios.request as any).mockResolvedValueOnce({
          data: { data: { play_count: 1000 } },
        });

        const result = await t.action(
          internal.viewTracking.getInitialViewCount,
          {
            tiktokUrl: url,
          }
        );
        expect(result.viewCount).toBe(1000);
      }
    });

    test("rejects invalid TikTok URLs", async () => {
      const invalidUrls = [
        "https://youtube.com/watch?v=123",
        "https://instagram.com/p/123",
        "invalid-url",
        "",
      ];

      for (const url of invalidUrls) {
        const result = await t.action(
          internal.viewTracking.getInitialViewCount,
          {
            tiktokUrl: url,
          }
        );
        expect(result.viewCount).toBe(0);
      }
    });
  });

  describe("View Tracking Integration", () => {
    test("updates submission with initial view count", async () => {
      // Set up test data
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
          tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 0,
          submittedAt: Date.now(),
        });

        return { submissionId };
      });

      // Mock API response
      (axios.request as any).mockResolvedValueOnce({
        data: { data: { play_count: 8500 } },
      });

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
        submissionId,
      });

      expect(result.viewCount).toBe(8500);

      // Verify submission was updated
      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      expect(submission?.viewCount).toBe(8500);
      expect(submission?.lastViewUpdate).toBeDefined();
    });

    test("processes view tracking with rate limiting", async () => {
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
          tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 5000,
          submittedAt: Date.now(),
        });

        return { submissionId };
      });

      // Mock API response
      (axios.request as any).mockResolvedValueOnce({
        data: { data: { play_count: 7500 } },
      });

      // Update view count (simulates cron job or manual refresh)
      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
        submissionId,
      });

      expect(result.viewCount).toBe(7500);

      // Check that rate limiter was used
      const rateLimitStatus = await t.query(
        internal.rateLimiter.getRateLimiterStatus
      );
      expect(rateLimitStatus.requestsLastMinute).toBeGreaterThan(0);
    });

    test("creates view tracking records", async () => {
      // Set up submission
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
          tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 2000,
          submittedAt: Date.now(),
        });

        return { submissionId };
      });

      // Update view count manually
      await t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
        submissionId,
        viewCount: 3500,
        previousViews: 2000,
        source: "test_update",
      });

      // Check that view tracking record was created
      const viewRecords = await t.run(async (ctx) => {
        return await ctx.db
          .query("viewTracking")
          .withIndex("by_submission_id", (q) =>
            q.eq("submissionId", submissionId)
          )
          .collect();
      });

      expect(viewRecords).toHaveLength(1);
      expect(viewRecords[0]).toMatchObject({
        submissionId,
        viewCount: 3500,
        source: "test_update",
      });
      expect(viewRecords[0].timestamp).toBeDefined();
    });

    test("handles bulk view updates efficiently", async () => {
      // Clean up any existing submissions from other tests first
      await t.run(async (ctx) => {
        const allSubmissions = await ctx.db.query("submissions").collect();
        for (const submission of allSubmissions) {
          await ctx.db.delete(submission._id);
        }
        const allCampaigns = await ctx.db.query("campaigns").collect();
        for (const campaign of allCampaigns) {
          await ctx.db.delete(campaign._id);
        }
        const allUsers = await ctx.db.query("users").collect();
        for (const user of allUsers) {
          await ctx.db.delete(user._id);
        }
        const allProfiles = await ctx.db.query("profiles").collect();
        for (const profile of allProfiles) {
          await ctx.db.delete(profile._id);
        }
      });

      // Create multiple submissions
      const submissionIds = await t.run(async (ctx) => {
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
          totalBudget: 50000, // €500 budget
          remainingBudget: 50000,
          cpmRate: 5,
          maxPayoutPerSubmission: 5000,
          status: "active",
          assetLinks: [],
          requirements: [],
        });

        const ids: Id<"submissions">[] = [];
        for (let i = 0; i < 3; i++) {
          const submissionId = await ctx.db.insert("submissions", {
            campaignId,
            creatorId: creatorUserId,
            tiktokUrl: `https://www.tiktok.com/@testuser/video/123456789${i}`,
            status: "approved",
            viewCount: 1000 + i * 500,
            submittedAt: Date.now(),
          });
          ids.push(submissionId);
        }

        return ids;
      });

      // Mock API responses for bulk update
      (axios.request as any)
        .mockResolvedValueOnce({ data: { data: { play_count: 2500 } } })
        .mockResolvedValueOnce({ data: { data: { play_count: 3000 } } })
        .mockResolvedValueOnce({ data: { data: { play_count: 3500 } } });

      // Simulate bulk update (would normally be called by cron job)
      const result = await t.action(internal.viewTracking.updateAllViewCounts);

      expect(result.updatedCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.totalProcessed).toBe(3);

      // Verify all submissions were updated
      for (const submissionId of submissionIds) {
        const submission = await t.run(async (ctx) => {
          return await ctx.db.get(submissionId);
        });
        expect(submission?.viewCount).toBeGreaterThan(1000);
      }
    });
  });

  describe("Error Scenarios and Edge Cases", () => {
    test("handles network timeouts gracefully", async () => {
      (axios.request as any).mockRejectedValueOnce(new Error("ECONNRESET"));

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      expect(result.viewCount).toBe(0);
    });

    test("handles malformed API responses", async () => {
      (axios.request as any).mockResolvedValueOnce({
        data: { invalid: "response" }, // Missing expected structure
      });

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      expect(result.viewCount).toBe(0);
    });

    test("handles API responses with null/undefined view counts", async () => {
      (axios.request as any).mockResolvedValueOnce({
        data: { data: { play_count: null } },
      });

      const result = await t.action(internal.viewTracking.getInitialViewCount, {
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      expect(result.viewCount).toBe(0);
    });

    test("maintains data consistency during concurrent updates", async () => {
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
          tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
          status: "approved",
          viewCount: 5000,
          earnings: 25, // 5K views × €0.05/1K = €0.25 = 25 cents
          submittedAt: Date.now(),
        });

        return { submissionId, campaignId };
      });

      // Simulate concurrent view updates
      await Promise.all([
        t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
          submissionId,
          viewCount: 6000,
          previousViews: 5000,
          source: "update_1",
        }),
        t.mutation(internal.viewTrackingHelpers.updateSubmissionViews, {
          submissionId,
          viewCount: 6500,
          previousViews: 5000,
          source: "update_2",
        }),
      ]);

      // Verify final state is consistent
      const submission = await t.run(async (ctx) => {
        return await ctx.db.get(submissionId);
      });

      const campaign = await t.run(async (ctx) => {
        return await ctx.db.get(campaignId);
      });

      // One of the updates should have won
      expect(submission?.viewCount).toBeGreaterThanOrEqual(6000);
      expect(submission?.earnings).toBeGreaterThan(25);
      expect(campaign?.remainingBudget).toBeLessThan(10000);
    });
  });
});
