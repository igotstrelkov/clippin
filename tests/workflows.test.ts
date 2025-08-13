import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Id } from "../convex/_generated/dataModel";
import { WorkflowContext } from "../convex/lib/workflowOrchestrator";
import {
  createApprovalWorkflow,
  executeApprovalWorkflow,
} from "../convex/lib/workflows/approvalWorkflow";
import {
  createSubmissionWorkflow,
  executeSubmissionWorkflow,
} from "../convex/lib/workflows/submissionWorkflow";
import schema from "../convex/schema";
import { TestDataFactory } from "./factories/testDataFactory";

describe("Workflow Orchestrators", () => {
  const t = convexTest(schema);

  beforeEach(() => {
    vi.clearAllMocks();
    TestDataFactory.resetIdCounter();
  });

  describe("SubmissionWorkflow", () => {
    test("successfully executes complete submission workflow", async () => {
      // Create test data
      const { campaign } = await t.run(async (ctx) => {
        const brand = TestDataFactory.User.create()
          .withEmail("brand@test.com")
          .build();

        const brandUser = await ctx.db.insert("users", brand);

        const brandProfile = TestDataFactory.Profile.create()
          .withUserId(brandUser)
          .asBrand()
          .withCompanyName("Test Company")
          .build();

        await ctx.db.insert("profiles", brandProfile);

        const campaign = TestDataFactory.Campaign.create()
          .withBrandId(brandUser)
          .asActive()
          .build();

        const campaignId = await ctx.db.insert("campaigns", campaign);

        return { campaign: { ...campaign, _id: campaignId } };
      });

      const creator = await t.run(async (ctx) => {
        const creator = TestDataFactory.User.create()
          .withEmail("creator@test.com")
          .build();

        const creatorUser = await ctx.db.insert("users", creator);

        const creatorProfile = TestDataFactory.Profile.create()
          .withUserId(creatorUser)
          .asCreator()
          .withTikTokVerified(true)
          .build();

        await ctx.db.insert("profiles", creatorProfile);

        return { user: creatorUser, profile: creatorProfile };
      });

      // Create mock context that properly implements Convex database interface
      const mockCtx: WorkflowContext = {
        db: {
          query: (table: string) => ({
            withIndex: (_indexName: string, _callback?: any) => ({
              unique: vi.fn().mockImplementation(async () => {
                // Return appropriate mock data based on the table
                if (table === "profiles") {
                  return creator.profile;
                }
                return null;
              })
            }),
            filter: () => ({
              first: vi.fn().mockResolvedValue(null) // No existing submissions
            })
          }),
          get: vi.fn().mockImplementation(async (id: any) => {
            if (id === campaign._id) return campaign;
            if (id === creator.user) return { _id: creator.user, email: "creator@test.com", name: "Test Creator User" };
            return null;
          }),
          insert: vi.fn().mockImplementation(async (table: string, data: any) => {
            return `${table}_${Date.now()}` as any;
          }),
          patch: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          system: {},
        } as any,
        storage: {
          getUrl: vi.fn().mockResolvedValue("https://example.com/file.jpg"),
        },
        scheduler: {
          runAfter: vi.fn().mockResolvedValue(undefined),
        },
        runQuery: undefined, // Force the workflow to use the default behavior
        runMutation: vi.fn().mockResolvedValue(undefined),
        runAction: vi.fn().mockResolvedValue(undefined),
      };

      // Execute workflow
      const result = await executeSubmissionWorkflow(mockCtx, creator.user, {
        campaignId: campaign._id,
        tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
      });

      // Verify results
      expect(result.success).toBe(true);
      expect(result.data?.message).toContain("Submission successful");
      expect(result.metadata?.totalSteps).toBeGreaterThan(0);
      expect(result.metadata?.successfulSteps).toBe(
        result.metadata?.totalSteps
      );
    });

    test("fails workflow when creator is not eligible", async () => {
      const campaign = await t.run(async (ctx) => {
        const brand = TestDataFactory.User.create()
          .withEmail("brand@test.com")
          .build();
        const brandUser = await ctx.db.insert("users", brand);

        const brandProfile = TestDataFactory.Profile.create()
          .withUserId(brandUser)
          .asBrand()
          .build();
        await ctx.db.insert("profiles", brandProfile);

        const campaign = TestDataFactory.Campaign.create()
          .withBrandId(brandUser)
          .asActive()
          .build();
        const campaignId = await ctx.db.insert("campaigns", campaign);

        return { ...campaign, _id: campaignId };
      });

      const creator = await t.run(async (ctx) => {
        const creator = TestDataFactory.User.create()
          .withEmail("creator@test.com")
          .build();
        const creatorUser = await ctx.db.insert("users", creator);

        // Create creator profile without TikTok verification
        const creatorProfile = TestDataFactory.Profile.create()
          .withUserId(creatorUser)
          .asCreator()
          .withTikTokVerified(false) // Not verified
          .build();
        await ctx.db.insert("profiles", creatorProfile);

        return { user: creatorUser, profile: creatorProfile };
      });

      // Create workflow with mocked context
      const workflow = createSubmissionWorkflow(
        {} as WorkflowContext, // Mock context not needed for this test
        creator.user,
        {
          campaignId: campaign._id,
          tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
        }
      );

      // Mock the data loading step
      (workflow as any).data = {
        profile: creator.profile,
        campaign: campaign,
        submissionArgs: {
          campaignId: campaign._id,
          creatorId: creator.user,
          tiktokUrl: "https://www.tiktok.com/@testuser/video/1234567890",
        },
      };

      // Test the eligibility validation step directly
      try {
        await (workflow as any).validateEligibility();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "verify your TikTok account"
        );
      }
    });

    test("handles URL duplication gracefully", async () => {
      const campaign = await t.run(async (ctx) => {
        const brand = TestDataFactory.User.create()
          .withEmail("brand@test.com")
          .build();
        const brandUser = await ctx.db.insert("users", brand);

        const brandProfile = TestDataFactory.Profile.create()
          .withUserId(brandUser)
          .asBrand()
          .build();
        await ctx.db.insert("profiles", brandProfile);

        const campaign = TestDataFactory.Campaign.create()
          .withBrandId(brandUser)
          .asActive()
          .build();
        const campaignId = await ctx.db.insert("campaigns", campaign);

        return { ...campaign, _id: campaignId };
      });

      const tiktokUrl = "https://www.tiktok.com/@testuser/video/1234567890";

      // Create existing submission with same URL
      const existingCreatorId = await t.run(async (ctx) => {
        const existingUser = TestDataFactory.User.create()
          .withEmail("existing@test.com")
          .build();
        return await ctx.db.insert("users", existingUser);
      });

      await t.run(async (ctx) => {
        const existingSubmission = TestDataFactory.Submission.create()
          .withCampaignId(campaign._id)
          .withCreatorId(existingCreatorId) // Different creator
          .withTikTokUrl(tiktokUrl)
          .build();
        await ctx.db.insert("submissions", existingSubmission);
      });

      const mockCtx: WorkflowContext = {
        db: {
          query: (table: string) => ({
            withIndex: (_indexName: string, _callback?: any) => ({
              unique: vi.fn().mockImplementation(async () => {
                // Mock profile data
                if (table === "profiles") {
                  return { userType: "creator", tiktokVerified: true };
                }
                return null;
              })
            }),
            filter: () => ({
              first: vi.fn().mockResolvedValue({
                _id: "existing_submission_id",
                tiktokUrl: tiktokUrl,
              }) // Return existing submission to trigger duplication error
            })
          }),
          get: vi.fn().mockImplementation(async (id: any) => {
            if (id === campaign._id) return campaign;
            return null;
          }),
          insert: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          system: {},
        } as any,
        storage: { getUrl: vi.fn() },
        scheduler: { runAfter: vi.fn() },
        runQuery: undefined, // Force the workflow to use the default behavior
        runMutation: vi.fn(),
        runAction: vi.fn(),
      };

      const result = await executeSubmissionWorkflow(
        mockCtx,
        "test_user_id" as Id<"users">,
        {
          campaignId: campaign._id,
          tiktokUrl: tiktokUrl,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("already been submitted");
    });
  });

  describe("ApprovalWorkflow", () => {
    test("successfully executes approval workflow", async () => {
      const { submission, campaign } = await t.run(async (ctx) => {
        // Create brand
        const brand = TestDataFactory.User.create()
          .withEmail("brand@test.com")
          .build();
        const brandUser = await ctx.db.insert("users", brand);

        const brandProfile = TestDataFactory.Profile.create()
          .withUserId(brandUser)
          .asBrand()
          .build();
        await ctx.db.insert("profiles", brandProfile);

        // Create creator
        const creator = TestDataFactory.User.create()
          .withEmail("creator@test.com")
          .build();
        const creatorUser = await ctx.db.insert("users", creator);

        const creatorProfile = TestDataFactory.Profile.create()
          .withUserId(creatorUser)
          .asCreator()
          .build();
        await ctx.db.insert("profiles", creatorProfile);

        // Create campaign
        const campaign = TestDataFactory.Campaign.create()
          .withBrandId(brandUser)
          .asActive()
          .build();
        const campaignId = await ctx.db.insert("campaigns", campaign);

        // Create submission
        const submission = TestDataFactory.Submission.create()
          .withCampaignId(campaignId)
          .withCreatorId(creatorUser)
          .asPending()
          .build();
        const submissionId = await ctx.db.insert("submissions", submission);

        return {
          submission: { ...submission, _id: submissionId },
          campaign: { ...campaign, _id: campaignId },
          brand: { user: brandUser, profile: brandProfile },
          creator: { user: creatorUser, profile: creatorProfile },
        };
      });

      // Create mock context
      const mockCtx: WorkflowContext = {
        db: {
          get: (id: any) =>
            t.run(async (ctx) => {
              if (id === submission._id) return submission;
              if (id === campaign._id) return campaign;
              return ctx.db.get(id);
            }),
          query: (_table: string) => ({
            withIndex: () => ({
              unique: vi.fn().mockResolvedValue({
                userType: "creator",
                creatorName: "Test Creator",
              }),
            }),
          }),
          patch: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn(),
          delete: vi.fn(),
          system: {},
        } as any,
        storage: { getUrl: vi.fn() },
        scheduler: {
          runAfter: vi.fn().mockResolvedValue(undefined),
        },
        runQuery: vi.fn(),
        runMutation: vi.fn(),
        runAction: vi.fn(),
      };

      const result = await executeApprovalWorkflow(
        mockCtx,
        campaign.brandId, // Brand user ID
        {
          submissionId: submission._id,
          status: "approved",
        }
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe("approved");
      expect(result.metadata?.totalSteps).toBeGreaterThan(0);
    });

    test("fails workflow when user lacks permission", async () => {
      const workflow = createApprovalWorkflow(
        {} as WorkflowContext,
        "wrong_user_id" as Id<"users">,
        {
          submissionId: "test_submission_id" as Id<"submissions">,
          status: "approved",
        }
      );

      // Mock the data with permission mismatch
      (workflow as any).data = {
        submission: { status: "pending", creatorId: "creator_id" },
        campaign: { brandId: "different_brand_id" }, // Different brand
      };

      try {
        await (workflow as any).validatePermissions();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("campaign owner");
      }
    });

    test("validates status transitions correctly", async () => {
      const workflow = createApprovalWorkflow(
        {} as WorkflowContext,
        "brand_user_id" as Id<"users">,
        {
          submissionId: "test_submission_id" as Id<"submissions">,
          status: "approved",
        }
      );

      // Mock data with already approved submission
      (workflow as any).data = {
        submission: { status: "approved" }, // Already approved
      };

      try {
        await (workflow as any).validateStatusTransition();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Invalid status transition");
      }
    });
  });

  describe("Workflow Error Handling", () => {
    test("handles step failures gracefully", async () => {
      const workflow = createSubmissionWorkflow(
        {} as WorkflowContext,
        "test_user_id" as Id<"users">,
        {
          campaignId: "test_campaign_id" as Id<"campaigns">,
          tiktokUrl: "https://www.tiktok.com/@test/video/123",
        }
      );

      // Test step execution with forced failure
      const result = await (workflow as any).executeStep(
        "testStep",
        async () => {
          throw new Error("Forced failure");
        },
        null,
        { required: false, retries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Forced failure");
      expect(result.stepName).toBe("testStep");
      expect(result.metadata?.attempts).toBe(2); // 1 initial + 1 retry
    });

    test("retries steps with exponential backoff", async () => {
      const workflow = createSubmissionWorkflow(
        {} as WorkflowContext,
        "test_user_id" as Id<"users">,
        {
          campaignId: "test_campaign_id" as Id<"campaigns">,
          tiktokUrl: "https://www.tiktok.com/@test/video/123",
        }
      );

      let attempts = 0;
      const startTime = Date.now();

      const result = await (workflow as any).executeStep(
        "retryStep",
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Not yet");
          }
          return "success";
        },
        null,
        { retries: 2 }
      );

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(attempts).toBe(3);
      // Should have some delay due to exponential backoff
      expect(endTime - startTime).toBeGreaterThan(1000); // At least 1 second delay
    });
  });

  describe("Workflow Execution Summary", () => {
    test("provides comprehensive execution summary", async () => {
      const workflow = createSubmissionWorkflow(
        {} as WorkflowContext,
        "test_user_id" as Id<"users">,
        {
          campaignId: "test_campaign_id" as Id<"campaigns">,
          tiktokUrl: "https://www.tiktok.com/@test/video/123",
        }
      );

      // Execute some test steps (with small delays to ensure duration > 0)
      await (workflow as any).executeStep(
        "step1",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return "success1";
        },
        null
      );
      await (workflow as any).executeStep(
        "step2",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          throw new Error("failure");
        },
        null,
        { required: false }
      );
      await (workflow as any).executeStep(
        "step3",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return "success3";
        },
        null
      );

      const summary = workflow.getExecutionSummary();

      expect(summary.totalSteps).toBe(3);
      expect(summary.successfulSteps).toBe(2);
      expect(summary.failedSteps).toBe(1);
      expect(summary.steps).toHaveLength(3);
      expect(summary.steps[0].name).toBe("step1");
      expect(summary.steps[0].success).toBe(true);
      expect(summary.steps[1].name).toBe("step2");
      expect(summary.steps[1].success).toBe(false);
      expect(summary.executionTime).toBeGreaterThan(0);
    });
  });
});
