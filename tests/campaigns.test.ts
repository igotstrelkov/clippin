import { describe, expect, test } from "vitest";
import { Doc, Id } from "../convex/_generated/dataModel";
import {
  calculateCampaignStats,
  canDeleteCampaign,
  findExpiredActiveCampaigns,
  groupCampaignsByStatus,
  isCampaignExpired,
  prepareCampaignCreation,
  prepareCampaignUpdate,
  validateCampaignAcceptance,
  validateCampaignCreation,
  validateCampaignUpdate,
  validateStatusTransition,
  type CampaignCreationArgs,
  type CampaignUpdateArgs,
} from "../convex/lib/campaigns";

// Helper to create mock campaign
function createMockCampaign(
  overrides: Partial<Doc<"campaigns">> = {}
): Doc<"campaigns"> {
  return {
    _id: "campaign123" as Id<"campaigns">,
    _creationTime: Date.now(),
    brandId: "brand123" as Id<"users">,
    title: "Test Campaign",
    description: "Test description for campaign",
    category: "lifestyle",
    totalBudget: 10000, // €100
    remainingBudget: 10000,
    cpmRate: 500, // €5 CPM
    maxPayoutPerSubmission: 2500, // €25 max
    assetLinks: [],
    requirements: [],
    status: "active",
    totalViews: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    paymentStatus: "paid",
    ...overrides,
  };
}

describe("CampaignService", () => {
  describe("validateCampaignCreation", () => {
    const validArgs: CampaignCreationArgs = {
      title: "Test Campaign",
      description: "This is a test campaign description",
      category: "lifestyle",
      totalBudget: 10000, // €100
      cpmRate: 500, // €5 CPM
      maxPayoutPerSubmission: 2500, // €25 max
      assetLinks: [],
      requirements: ["Must be family-friendly"],
    };

    test("validates correct campaign creation", () => {
      const result = validateCampaignCreation(validArgs);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects empty title", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        title: "",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Campaign title is required");
    });

    test("rejects title too short", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        title: "Hi",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Campaign title must be at least 3 characters"
      );
    });

    test("rejects title too long", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        title: "A".repeat(101),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Campaign title must be less than 100 characters"
      );
    });

    test("rejects empty description", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        description: "",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Campaign description is required");
    });

    test("rejects description too short", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        description: "Short",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Campaign description must be at least 10 characters"
      );
    });

    test("rejects invalid category", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        category: "invalid-category",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid campaign category");
    });

    test("rejects past end date", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        endDate: Date.now() - 1000, // Past date
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Campaign end date must be in the future"
      );
    });

    test("accepts valid end date", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        endDate: Date.now() + 86400000, // Tomorrow
      });
      expect(result.isValid).toBe(true);
    });

    test("validates budget constraints", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        totalBudget: 3000, // Below minimum
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Minimum campaign budget is €50.00");
    });

    test("accumulates multiple validation errors", () => {
      const result = validateCampaignCreation({
        ...validArgs,
        title: "Hi",
        description: "Short",
        category: "invalid",
        totalBudget: 3000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe("validateCampaignUpdate", () => {
    const mockCampaign = createMockCampaign();

    test("validates correct update", () => {
      const updateArgs: CampaignUpdateArgs = {
        title: "Updated Campaign Title",
        description: "Updated campaign description",
      };

      const result = validateCampaignUpdate(mockCampaign, updateArgs);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects empty title update", () => {
      const result = validateCampaignUpdate(mockCampaign, { title: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Campaign title cannot be empty");
    });

    test("validates status transitions", () => {
      const result = validateCampaignUpdate(mockCampaign, { status: "paused" });
      expect(result.isValid).toBe(true);
    });

    test("rejects invalid status transition", () => {
      const completedCampaign = createMockCampaign({ status: "completed" });
      const result = validateCampaignUpdate(completedCampaign, {
        status: "active",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid status transition from completed to active"
      );
    });

    test("allows undefined values", () => {
      const result = validateCampaignUpdate(mockCampaign, { title: undefined });
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateStatusTransition", () => {
    test("allows valid transitions", () => {
      expect(validateStatusTransition("draft", "active").isValid).toBe(true);
      expect(validateStatusTransition("active", "paused").isValid).toBe(true);
      expect(validateStatusTransition("active", "completed").isValid).toBe(
        true
      );
      expect(validateStatusTransition("paused", "active").isValid).toBe(true);
      expect(validateStatusTransition("paused", "completed").isValid).toBe(
        true
      );
    });

    test("rejects invalid transitions", () => {
      expect(validateStatusTransition("draft", "paused").isValid).toBe(false);
      expect(validateStatusTransition("completed", "active").isValid).toBe(
        false
      );
      expect(validateStatusTransition("completed", "paused").isValid).toBe(
        false
      );
      expect(validateStatusTransition("active", "draft").isValid).toBe(false);
    });

    test("provides error messages for invalid transitions", () => {
      const result = validateStatusTransition("completed", "active");
      expect(result.error).toBe(
        "Invalid status transition from completed to active"
      );
    });
  });

  describe("validateCampaignAcceptance", () => {
    test("allows submissions for active campaign with budget", () => {
      const campaign = createMockCampaign({
        status: "active",
        remainingBudget: 5000,
      });
      const result = validateCampaignAcceptance(campaign);
      expect(result.canAccept).toBe(true);
    });

    test("rejects submissions for paused campaign", () => {
      const campaign = createMockCampaign({ status: "paused" });
      const result = validateCampaignAcceptance(campaign);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe("Campaign is paused");
    });

    test("rejects submissions for completed campaign", () => {
      const campaign = createMockCampaign({ status: "completed" });
      const result = validateCampaignAcceptance(campaign);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe("Campaign is completed");
    });

    test("rejects submissions when budget exhausted", () => {
      const campaign = createMockCampaign({
        status: "active",
        remainingBudget: 0,
      });
      const result = validateCampaignAcceptance(campaign);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe("Campaign budget exhausted");
    });

    test("rejects submissions for expired campaign", () => {
      const campaign = createMockCampaign({
        status: "active",
        remainingBudget: 5000,
        endDate: Date.now() - 1000, // Past date
      });
      const result = validateCampaignAcceptance(campaign);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toBe("Campaign has ended");
    });
  });

  describe("canDeleteCampaign", () => {
    test("allows deletion of draft campaign without submissions", () => {
      const campaign = createMockCampaign({ status: "draft" });
      const result = canDeleteCampaign(campaign, false);
      expect(result.canDelete).toBe(true);
    });

    test("allows deletion of paused campaign without submissions", () => {
      const campaign = createMockCampaign({ status: "paused" });
      const result = canDeleteCampaign(campaign, false);
      expect(result.canDelete).toBe(true);
    });

    test("rejects deletion when campaign has submissions", () => {
      const campaign = createMockCampaign({ status: "draft" });
      const result = canDeleteCampaign(campaign, true);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe("Campaign has existing submissions");
    });

    test("rejects deletion of active campaign", () => {
      const campaign = createMockCampaign({ status: "active" });
      const result = canDeleteCampaign(campaign, false);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe("Cannot delete active campaign");
    });

    test("rejects deletion of completed campaign", () => {
      const campaign = createMockCampaign({ status: "completed" });
      const result = canDeleteCampaign(campaign, false);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toBe("Cannot delete completed campaign");
    });
  });

  describe("calculateCampaignStats", () => {
    test("calculates stats for single campaign", () => {
      const campaigns = [
        createMockCampaign({
          totalBudget: 10000,
          remainingBudget: 5000,
          totalViews: 20000,
          totalSubmissions: 5,
        }),
      ];

      const stats = calculateCampaignStats(campaigns);
      expect(stats.totalSpent).toBe(5000); // 10000 - 5000
      expect(stats.totalViews).toBe(20000);
      expect(stats.totalSubmissions).toBe(5);
      expect(stats.avgCpm).toBe(250); // (5000 / 20000) * 1000
    });

    test("calculates stats for multiple campaigns", () => {
      const campaigns = [
        createMockCampaign({
          totalBudget: 10000,
          remainingBudget: 5000,
          totalViews: 10000,
          totalSubmissions: 2,
        }),
        createMockCampaign({
          totalBudget: 20000,
          remainingBudget: 10000,
          totalViews: 30000,
          totalSubmissions: 3,
        }),
      ];

      const stats = calculateCampaignStats(campaigns);
      expect(stats.totalSpent).toBe(15000); // (10000-5000) + (20000-10000)
      expect(stats.totalViews).toBe(40000); // 10000 + 30000
      expect(stats.totalSubmissions).toBe(5); // 2 + 3
      expect(stats.avgCpm).toBe(375); // (15000 / 40000) * 1000
    });

    test("handles zero views correctly", () => {
      const campaigns = [
        createMockCampaign({
          totalBudget: 10000,
          remainingBudget: 10000,
          totalViews: 0,
          totalSubmissions: 0,
        }),
      ];

      const stats = calculateCampaignStats(campaigns);
      expect(stats.avgCpm).toBe(0);
    });

    test("handles empty campaigns array", () => {
      const stats = calculateCampaignStats([]);
      expect(stats.totalSpent).toBe(0);
      expect(stats.totalViews).toBe(0);
      expect(stats.totalSubmissions).toBe(0);
      expect(stats.avgCpm).toBe(0);
    });
  });

  describe("prepareCampaignCreation", () => {
    test("prepares campaign data correctly", () => {
      const brandId = "brand123" as Id<"users">;
      const args: CampaignCreationArgs = {
        title: "  Test Campaign  ",
        description: "  Test description  ",
        category: "lifestyle",
        totalBudget: 10000,
        cpmRate: 500,
        maxPayoutPerSubmission: 2500,
        endDate: Date.now() + 86400000,
        assetLinks: ["https://example.com/asset1"],
        requirements: ["Requirement 1", "", "Requirement 2", "   "],
      };

      const result = prepareCampaignCreation(brandId, args);

      expect(result.brandId).toBe(brandId);
      expect(result.title).toBe("Test Campaign"); // Trimmed
      expect(result.description).toBe("Test description"); // Trimmed
      expect(result.category).toBe("lifestyle");
      expect(result.totalBudget).toBe(10000);
      expect(result.remainingBudget).toBe(10000); // Same as total initially
      expect(result.status).toBe("draft");
      expect(result.paymentStatus).toBe("pending");
      expect(result.requirements).toEqual(["Requirement 1", "Requirement 2"]); // Filtered
      expect(result.totalViews).toBe(0);
      expect(result.totalSubmissions).toBe(0);
      expect(result.approvedSubmissions).toBe(0);
    });
  });

  describe("prepareCampaignUpdate", () => {
    test("prepares update data correctly", () => {
      const args: CampaignUpdateArgs = {
        title: "  Updated Title  ",
        description: "  Updated description  ",
        requirements: ["New req", "", "Another req"],
        status: "paused",
      };

      const result = prepareCampaignUpdate(args);

      expect(result.title).toBe("Updated Title"); // Trimmed
      expect(result.description).toBe("Updated description"); // Trimmed
      expect(result.requirements).toEqual(["New req", "Another req"]); // Filtered
      expect(result.status).toBe("paused");
    });

    test("handles undefined values", () => {
      const result = prepareCampaignUpdate({});
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe("isCampaignExpired", () => {
    test("returns false for campaign without end date", () => {
      const campaign = createMockCampaign({ endDate: undefined });
      expect(isCampaignExpired(campaign)).toBe(false);
    });

    test("returns false for campaign with future end date", () => {
      const campaign = createMockCampaign({ endDate: Date.now() + 86400000 });
      expect(isCampaignExpired(campaign)).toBe(false);
    });

    test("returns true for campaign with past end date", () => {
      const campaign = createMockCampaign({ endDate: Date.now() - 1000 });
      expect(isCampaignExpired(campaign)).toBe(true);
    });
  });

  describe("findExpiredActiveCampaigns", () => {
    test("finds expired active campaigns", () => {
      const campaigns = [
        createMockCampaign({
          status: "active",
          endDate: Date.now() + 86400000,
        }), // Future
        createMockCampaign({ status: "active", endDate: Date.now() - 1000 }), // Expired
        createMockCampaign({ status: "paused", endDate: Date.now() - 1000 }), // Expired but not active
        createMockCampaign({ status: "active", endDate: undefined }), // No end date
      ];

      const expired = findExpiredActiveCampaigns(campaigns);
      expect(expired).toHaveLength(1);
      expect(expired[0].endDate).toBeLessThan(Date.now());
    });
  });

  describe("groupCampaignsByStatus", () => {
    test("groups campaigns correctly", () => {
      const campaigns = [
        createMockCampaign({ status: "draft" }),
        createMockCampaign({ status: "active" }),
        createMockCampaign({ status: "paused" }),
        createMockCampaign({ status: "completed" }),
        createMockCampaign({ status: "active" }),
      ];

      const grouped = groupCampaignsByStatus(campaigns);
      expect(grouped.draft).toHaveLength(1);
      expect(grouped.active).toHaveLength(3); // active + paused
      expect(grouped.completed).toHaveLength(1);
    });
  });

  describe("Integration scenarios", () => {
    test("complete campaign lifecycle validation", () => {
      // Create campaign
      const creationArgs: CampaignCreationArgs = {
        title: "Integration Test Campaign",
        description: "This is an integration test campaign",
        category: "tech",
        totalBudget: 50000, // €500
        cpmRate: 1000, // €10 CPM
        maxPayoutPerSubmission: 10000, // €100 max
        assetLinks: ["https://example.com/asset"],
        requirements: ["Must be tech-focused"],
      };

      // Validate creation
      const creationValidation = validateCampaignCreation(creationArgs);
      expect(creationValidation.isValid).toBe(true);

      // Prepare campaign data
      const brandId = "brand123" as Id<"users">;
      const campaignData = prepareCampaignCreation(brandId, creationArgs);
      const campaign = {
        ...campaignData,
        _id: "campaign123" as Id<"campaigns">,
        _creationTime: Date.now(),
      } as Doc<"campaigns">;

      // Test transitions: draft -> active -> paused -> active -> completed
      expect(validateStatusTransition(campaign.status, "active").isValid).toBe(
        true
      );
      campaign.status = "active";

      expect(validateCampaignAcceptance(campaign).canAccept).toBe(true);

      expect(validateStatusTransition(campaign.status, "paused").isValid).toBe(
        true
      );
      campaign.status = "paused";

      expect(validateCampaignAcceptance(campaign).canAccept).toBe(false);

      expect(validateStatusTransition(campaign.status, "active").isValid).toBe(
        true
      );
      campaign.status = "active";

      expect(
        validateStatusTransition(campaign.status, "completed").isValid
      ).toBe(true);
      campaign.status = "completed";

      expect(validateCampaignAcceptance(campaign).canAccept).toBe(false);
      expect(canDeleteCampaign(campaign, false).canDelete).toBe(false);
    });

    test("campaign budget exhaustion scenario", () => {
      const campaign = createMockCampaign({
        status: "active",
        totalBudget: 10000, // €100
        remainingBudget: 500, // €5 remaining
        cpmRate: 1000, // €10 CPM
      });

      // Should still accept submissions with some budget
      expect(validateCampaignAcceptance(campaign).canAccept).toBe(true);

      // Exhaust budget
      campaign.remainingBudget = 0;
      expect(validateCampaignAcceptance(campaign).canAccept).toBe(false);
      expect(validateCampaignAcceptance(campaign).reason).toBe(
        "Campaign budget exhausted"
      );
    });
  });
});
