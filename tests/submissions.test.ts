import { describe, expect, test } from "vitest";
import { Doc, Id } from "../convex/_generated/dataModel";
import {
  calculateSubmissionEarnings,
  calculateSubmissionStats,
  canUpdateSubmissionStatus,
  checkUrlDuplication,
  findExpiredPendingSubmissions,
  groupSubmissionsByStatus,
  isSubmissionEligibleForAutoApproval,
  isValidContentUrl,
  prepareSubmissionCreation,
  prepareSubmissionUpdate,
  validateStatusTransition,
  validateSubmissionData,
  type SubmissionCreationArgs,
  type SubmissionUpdateArgs,
} from "../convex/lib/submissions";

// Helper functions to create mock data
function createMockProfile(
  overrides: Partial<Doc<"profiles">> = {}
): Doc<"profiles"> {
  return {
    _id: "profile123" as Id<"profiles">,
    _creationTime: Date.now(),
    userId: "user123" as Id<"users">,
    userType: "creator",
    creatorName: "Test Creator",
    tiktokUsername: "@testcreator",
    tiktokVerified: true,
    totalEarnings: 0,
    totalSubmissions: 0,
    ...overrides,
  };
}

function createMockCampaign(
  overrides: Partial<Doc<"campaigns">> = {}
): Doc<"campaigns"> {
  return {
    _id: "campaign123" as Id<"campaigns">,
    _creationTime: Date.now(),
    brandId: "brand123" as Id<"users">,
    title: "Test Campaign",
    description: "Test campaign description",
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

function createMockSubmission(
  overrides: Partial<Doc<"submissions">> = {}
): Doc<"submissions"> {
  return {
    _id: "submission123" as Id<"submissions">,
    _creationTime: Date.now(),
    campaignId: "campaign123" as Id<"campaigns">,
    creatorId: "creator123" as Id<"users">,
    contentUrl: "https://www.tiktok.com/@testuser/video/7123456789",
    status: "pending",
    viewCount: 1000,

    submittedAt: Date.now(),
    platform: "tiktok",
    ...overrides,
  };
}

describe("SubmissionService", () => {
  describe("isValidContentUrl", () => {
    test("validates standard TikTok URLs", () => {
      expect(
        isValidContentUrl("https://www.tiktok.com/@user/video/123456789")
      ).toBe(true);
      expect(
        isValidContentUrl("http://www.tiktok.com/@user/video/123456789")
      ).toBe(true);
      expect(
        isValidContentUrl("https://tiktok.com/@user/video/123456789")
      ).toBe(true);
    });

    test("validates mobile TikTok URLs", () => {
      expect(isValidContentUrl("https://vm.tiktok.com/abc123")).toBe(true);
      expect(isValidContentUrl("http://vm.tiktok.com/xyz789")).toBe(true);
    });

    test("validates short /t/ TikTok URLs", () => {
      expect(isValidContentUrl("https://www.tiktok.com/t/abc123")).toBe(true);
      expect(isValidContentUrl("http://tiktok.com/t/xyz789")).toBe(true);
    });

    test("rejects invalid URLs", () => {
      expect(isValidContentUrl("https://youtube.com/watch?v=123")).toBe(false);
      expect(isValidContentUrl("https://instagram.com/123")).toBe(false);
      expect(isValidContentUrl("https://tiktok.com/invalid")).toBe(false);
      expect(isValidContentUrl("not-a-url")).toBe(false);
      expect(isValidContentUrl("")).toBe(false);
    });

    test("handles usernames with special characters", () => {
      expect(
        isValidContentUrl("https://www.tiktok.com/@user.name/video/123456789")
      ).toBe(true);
      expect(
        isValidContentUrl("https://www.tiktok.com/@user-name/video/123456789")
      ).toBe(true);
      expect(
        isValidContentUrl("https://www.tiktok.com/@user_name/video/123456789")
      ).toBe(true);
    });
  });

  describe("validateSubmissionData", () => {
    test("validates correct submission data", () => {
      const args: SubmissionCreationArgs = {
        campaignId: "campaign123" as Id<"campaigns">,
        creatorId: "creator123" as Id<"users">,
        contentUrl: "https://www.tiktok.com/@testuser/video/123456789",
        platform: "tiktok",
      };

      const result = validateSubmissionData(args);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects empty TikTok URL", () => {
      const args: SubmissionCreationArgs = {
        campaignId: "campaign123" as Id<"campaigns">,
        creatorId: "creator123" as Id<"users">,
        contentUrl: "",
        platform: "tiktok",
      };

      const result = validateSubmissionData(args);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Content URL is required");
    });

    test("rejects invalid TikTok URL", () => {
      const args: SubmissionCreationArgs = {
        campaignId: "campaign123" as Id<"campaigns">,
        creatorId: "creator123" as Id<"users">,
        contentUrl: "https://youtube.com/watch?v=123",
        platform: "tiktok",
      };

      const result = validateSubmissionData(args);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Please provide a valid TikTok or Instagram URL"
      );
    });

    test("trims whitespace from URL", () => {
      const args: SubmissionCreationArgs = {
        campaignId: "campaign123" as Id<"campaigns">,
        creatorId: "creator123" as Id<"users">,
        contentUrl: "   https://www.tiktok.com/@testuser/video/123456789   ",
        platform: "tiktok",
      };

      const result = validateSubmissionData(args);
      expect(result.isValid).toBe(true);
    });
  });

  describe("checkUrlDuplication", () => {
    test("allows unique URL", () => {
      const result = checkUrlDuplication(
        "https://www.tiktok.com/@user/video/123",
        null
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects duplicate URL", () => {
      const existingSubmission = createMockSubmission();
      const result = checkUrlDuplication("duplicate-url", existingSubmission, "tiktok");

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "This TikTok video has already been submitted to a campaign"
      );
    });
  });

  describe("validateStatusTransition", () => {
    test("allows valid transitions", () => {
      expect(validateStatusTransition("pending", "approved").isValid).toBe(
        true
      );
      expect(validateStatusTransition("pending", "rejected").isValid).toBe(
        true
      );
    });

    test("rejects invalid transitions", () => {
      expect(validateStatusTransition("approved", "pending").isValid).toBe(
        false
      );
      expect(validateStatusTransition("approved", "rejected").isValid).toBe(
        false
      );
      expect(validateStatusTransition("rejected", "pending").isValid).toBe(
        false
      );
      expect(validateStatusTransition("rejected", "approved").isValid).toBe(
        false
      );
    });

    test("provides error messages for invalid transitions", () => {
      const result = validateStatusTransition("approved", "rejected");
      expect(result.error).toBe(
        "Invalid status transition from approved to rejected"
      );
    });
  });

  describe("canUpdateSubmissionStatus", () => {
    const brandId = "brand123" as Id<"users">;
    const wrongUserId = "wrong123" as Id<"users">;

    test("allows authorized brand to update pending submission", () => {
      const submission = createMockSubmission({ status: "pending" });
      const campaign = createMockCampaign({ brandId });

      const result = canUpdateSubmissionStatus(submission, campaign, brandId);
      expect(result.hasPermission).toBe(true);
    });

    test("rejects unauthorized user", () => {
      const submission = createMockSubmission({ status: "pending" });
      const campaign = createMockCampaign({ brandId });

      const result = canUpdateSubmissionStatus(
        submission,
        campaign,
        wrongUserId
      );
      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe(
        "Only the campaign owner can update submission status"
      );
    });

    test("rejects updating non-pending submission", () => {
      const submission = createMockSubmission({ status: "approved" });
      const campaign = createMockCampaign({ brandId });

      const result = canUpdateSubmissionStatus(submission, campaign, brandId);
      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe(
        "Cannot update submission with status: approved"
      );
    });

    test("rejects updating verifying_owner submission", () => {
      const submission = createMockSubmission({ status: "verifying_owner" });
      const campaign = createMockCampaign({ brandId });

      const result = canUpdateSubmissionStatus(submission, campaign, brandId);
      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe(
        "Cannot update submission with status: verifying_owner"
      );
    });
  });

  describe("isSubmissionEligibleForAutoApproval", () => {
    test("returns true for old pending submissions", () => {
      const oldSubmission = createMockSubmission({
        status: "pending",
        submittedAt: Date.now() - 49 * 60 * 60 * 1000, // 49 hours ago
      });

      expect(isSubmissionEligibleForAutoApproval(oldSubmission, 48)).toBe(true);
    });

    test("returns false for recent pending submissions", () => {
      const recentSubmission = createMockSubmission({
        status: "pending",
        submittedAt: Date.now() - 47 * 60 * 60 * 1000, // 47 hours ago
      });

      expect(isSubmissionEligibleForAutoApproval(recentSubmission, 48)).toBe(
        false
      );
    });

    test("returns false for non-pending submissions", () => {
      const approvedSubmission = createMockSubmission({
        status: "approved",
        submittedAt: Date.now() - 49 * 60 * 60 * 1000, // 49 hours ago
      });

      expect(isSubmissionEligibleForAutoApproval(approvedSubmission, 48)).toBe(
        false
      );
    });

    test("accepts custom threshold", () => {
      const submission = createMockSubmission({
        status: "pending",
        submittedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      });

      expect(isSubmissionEligibleForAutoApproval(submission, 24)).toBe(true);
      expect(isSubmissionEligibleForAutoApproval(submission, 48)).toBe(false);
    });
  });

  describe("calculateSubmissionEarnings", () => {
    test("calculates earnings for approved submission", () => {
      const submission = createMockSubmission({
        status: "approved",
        viewCount: 10000,
      });
      const campaign = createMockCampaign({
        cpmRate: 500, // €5 CPM
        maxPayoutPerSubmission: 5000, // €50 max
      });

      const earnings = calculateSubmissionEarnings(submission, campaign);
      expect(earnings).toBe(5000); // 10K views * €5/1000 = €50, but capped at €50
    });

    test("returns 0 for pending submission", () => {
      const submission = createMockSubmission({
        status: "pending",
        viewCount: 10000,
      });
      const campaign = createMockCampaign();

      const earnings = calculateSubmissionEarnings(submission, campaign);
      expect(earnings).toBe(0);
    });

    test("returns 0 for rejected submission", () => {
      const submission = createMockSubmission({
        status: "rejected",
        viewCount: 10000,
      });
      const campaign = createMockCampaign();

      const earnings = calculateSubmissionEarnings(submission, campaign);
      expect(earnings).toBe(0);
    });
  });

  describe("prepareSubmissionCreation", () => {
    test("prepares submission data correctly", () => {
      const args: SubmissionCreationArgs = {
        campaignId: "campaign123" as Id<"campaigns">,
        creatorId: "creator123" as Id<"users">,
        contentUrl: "  https://www.tiktok.com/@test/video/123  ",
        platform: "tiktok",
      };

      const result = prepareSubmissionCreation(args);

      expect(result.campaignId).toBe(args.campaignId);
      expect(result.creatorId).toBe(args.creatorId);
      expect(result.contentUrl).toBe("https://www.tiktok.com/@test/video/123"); // Trimmed
      expect(result.status).toBe("verifying_owner");
      expect(result.viewCount).toBe(0);
      expect(result.submittedAt).toBeDefined();
    });

    test("uses default initial view count", () => {
      const args: SubmissionCreationArgs = {
        campaignId: "campaign123" as Id<"campaigns">,
        creatorId: "creator123" as Id<"users">,
        contentUrl: "https://www.tiktok.com/@test/video/123",
        platform: "tiktok",
      };

      const result = prepareSubmissionCreation(args);

      expect(result.viewCount).toBe(0);
    });
  });

  describe("prepareSubmissionUpdate", () => {
    test("prepares status update with approval", () => {
      const args: SubmissionUpdateArgs = {
        status: "approved",
        viewCount: 5000,
        earnings: 2500,
      };

      const result = prepareSubmissionUpdate(args);

      expect(result.status).toBe("approved");
      expect(result.approvedAt).toBeDefined();
      expect(result.viewCount).toBe(5000);
      expect(result.earnings).toBe(2500);
    });

    test("prepares status update with rejection", () => {
      const args: SubmissionUpdateArgs = {
        status: "rejected",
        rejectionReason: "Does not meet requirements",
      };

      const result = prepareSubmissionUpdate(args, "rejected");

      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toBe("Does not meet requirements");
      expect(result.approvedAt).toBeUndefined();
    });

    test("handles partial updates", () => {
      const args: SubmissionUpdateArgs = {
        viewCount: 1500,
      };

      const result = prepareSubmissionUpdate(args);

      expect(result.viewCount).toBe(1500);
      expect(result.status).toBeUndefined();
      expect(result.earnings).toBeUndefined();
    });
  });

  describe("calculateSubmissionStats", () => {
    test("calculates stats for mixed submissions", () => {
      const submissions = [
        createMockSubmission({
          status: "approved",
          viewCount: 5000,
          earnings: 2500,
        }),
        createMockSubmission({
          status: "pending",
          viewCount: 1500,
          earnings: 0,
        }),
        createMockSubmission({
          status: "rejected",
          viewCount: 800,
          earnings: 0,
        }),
        createMockSubmission({
          status: "approved",
          viewCount: 3000,
          earnings: 1500,
        }),
      ];

      const stats = calculateSubmissionStats(submissions);

      expect(stats.totalSubmissions).toBe(4);
      expect(stats.approvedSubmissions).toBe(2);
      expect(stats.rejectedSubmissions).toBe(1);
      expect(stats.pendingSubmissions).toBe(1);
      expect(stats.totalViews).toBe(10300); // 5000+1500+800+3000
      expect(stats.totalEarnings).toBe(4000); // 2500+0+0+1500
      expect(stats.avgViewsPerSubmission).toBe(2575); // 10300/4
    });

    test("handles empty submissions array", () => {
      const stats = calculateSubmissionStats([]);

      expect(stats.totalSubmissions).toBe(0);
      expect(stats.approvedSubmissions).toBe(0);
      expect(stats.rejectedSubmissions).toBe(0);
      expect(stats.pendingSubmissions).toBe(0);
      expect(stats.totalViews).toBe(0);
      expect(stats.totalEarnings).toBe(0);
      expect(stats.avgViewsPerSubmission).toBe(0);
    });
  });

  describe("groupSubmissionsByStatus", () => {
    test("groups submissions correctly", () => {
      const submissions = [
        createMockSubmission({ status: "pending" }),
        createMockSubmission({ status: "approved" }),
        createMockSubmission({ status: "rejected" }),
        createMockSubmission({ status: "pending" }),
        createMockSubmission({ status: "approved" }),
      ];

      const grouped = groupSubmissionsByStatus(submissions);

      expect(grouped.pending).toHaveLength(2);
      expect(grouped.approved).toHaveLength(2);
      expect(grouped.rejected).toHaveLength(1);
    });
  });

  describe("findExpiredPendingSubmissions", () => {
    test("finds expired pending submissions", () => {
      const submissions = [
        createMockSubmission({
          status: "pending",
          submittedAt: Date.now() - 50 * 60 * 60 * 1000, // 50 hours ago
        }),
        createMockSubmission({
          status: "pending",
          submittedAt: Date.now() - 40 * 60 * 60 * 1000, // 40 hours ago
        }),
        createMockSubmission({
          status: "approved",
          submittedAt: Date.now() - 50 * 60 * 60 * 1000, // 50 hours ago
        }),
      ];

      const expired = findExpiredPendingSubmissions(submissions, 48);

      expect(expired).toHaveLength(1);
      expect(expired[0].submittedAt).toBeLessThan(
        Date.now() - 48 * 60 * 60 * 1000
      );
    });
  });

  describe("Integration scenarios", () => {
    test("complete submission lifecycle validation", () => {
      const profile = createMockProfile();
      const campaign = createMockCampaign();

      // 1. Validate submission data
      const submissionArgs: SubmissionCreationArgs = {
        campaignId: campaign._id,
        creatorId: profile.userId,
        contentUrl: "https://www.tiktok.com/@creator/video/123456789",
        platform: "tiktok",
      };

      const dataValidation = validateSubmissionData(submissionArgs);
      expect(dataValidation.isValid).toBe(true);

      // 2. Check for duplicates
      const duplicationCheck = checkUrlDuplication(
        submissionArgs.contentUrl,
        null
      );
      expect(duplicationCheck.isValid).toBe(true);

      // 3. Prepare submission creation
      const submissionData = prepareSubmissionCreation(submissionArgs);
      const submission = {
        ...submissionData,
        _id: "sub123" as Id<"submissions">,
        _creationTime: Date.now(),
      } as Doc<"submissions">;

      // 4. Test status transitions
      expect(
        canUpdateSubmissionStatus(submission, campaign, campaign.brandId)
          .hasPermission
      ).toBe(false); // verifying_owner submissions cannot be manually updated

      // Once the system verifies the owner, it will update the status to pending automatically

      expect(validateStatusTransition("pending", "approved").isValid).toBe(
        true
      );

      // 5. Test approval
      const updateArgs: SubmissionUpdateArgs = { status: "approved" };
      const updates = prepareSubmissionUpdate(updateArgs);
      submission.status = "approved";
      submission.approvedAt = updates.approvedAt!;

      // 6. Calculate earnings
      submission.viewCount = 10000;
      const earnings = calculateSubmissionEarnings(submission, campaign);
      expect(earnings).toBeGreaterThan(0);
    });
  });
});
