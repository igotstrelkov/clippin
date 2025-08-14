import { beforeEach, describe, expect, test } from "vitest";
import {
  CampaignBuilder,
  PaymentBuilder,
  ProfileBuilder,
  ScenarioBuilder,
  SubmissionBuilder,
  TestDataFactory,
  UserBuilder,
  ViewTrackingBuilder,
} from "./factories/testDataFactory";

describe("Test Data Factory", () => {
  beforeEach(() => {
    TestDataFactory.resetIdCounter();
  });

  describe("UserBuilder", () => {
    test("creates user with defaults", () => {
      const user = UserBuilder.create().build();

      expect(user._id).toBeDefined();
      expect(user._creationTime).toBeDefined();
      expect(user.email).toMatch(/user\d+@test\.com/);
      expect(user.name).toMatch(/Test User \d+/);
    });

    test("creates user with custom data", () => {
      const user = UserBuilder.create()
        .withEmail("custom@test.com")
        .withName("Custom User")
        .build();

      expect(user.email).toBe("custom@test.com");
      expect(user.name).toBe("Custom User");
    });
  });

  describe("ProfileBuilder", () => {
    test("creates creator profile", () => {
      const userId = "user123" as any;
      const profile = ProfileBuilder.create()
        .withUserId(userId)
        .asCreator()
        .build();

      expect(profile.userId).toBe(userId);
      expect(profile.userType).toBe("creator");
      expect(profile.creatorName).toBeDefined();
      expect(profile.tiktokUsername).toBeDefined();
      expect(profile.tiktokVerified).toBe(true);
      expect(profile.totalEarnings).toBe(0);
    });

    test("creates brand profile", () => {
      const userId = "user123" as any;
      const profile = ProfileBuilder.create()
        .withUserId(userId)
        .asBrand()
        .withCompanyName("Test Company")
        .build();

      expect(profile.userId).toBe(userId);
      expect(profile.userType).toBe("brand");
      expect(profile.companyName).toBe("Test Company");
    });

    test("throws error without userId", () => {
      expect(() => {
        ProfileBuilder.create().build();
      }).toThrow("Profile must have a userId");
    });
  });

  describe("CampaignBuilder", () => {
    test("creates campaign with defaults", () => {
      const brandId = "brand123" as any;
      const campaign = CampaignBuilder.create().withBrandId(brandId).build();

      expect(campaign.brandId).toBe(brandId);
      expect(campaign.title).toMatch(/Test Campaign \d+/);
      expect(campaign.description).toBeDefined();
      expect(campaign.category).toBe("lifestyle");
      expect(campaign.totalBudget).toBe(10000);
      expect(campaign.remainingBudget).toBe(10000);
      expect(campaign.cpmRate).toBe(500);
      expect(campaign.maxPayoutPerSubmission).toBe(2500);
      expect(campaign.status).toBe("active");
      expect(campaign.paymentStatus).toBe("paid");
      expect(campaign.totalViews).toBe(0);
      expect(campaign.totalSubmissions).toBe(0);
      expect(campaign.approvedSubmissions).toBe(0);
    });

    test("creates draft campaign", () => {
      const brandId = "brand123" as any;
      const campaign = CampaignBuilder.create()
        .withBrandId(brandId)
        .asDraft()
        .build();

      expect(campaign.status).toBe("draft");
      expect(campaign.paymentStatus).toBe("pending");
    });

    test("creates completed campaign", () => {
      const brandId = "brand123" as any;
      const campaign = CampaignBuilder.create()
        .withBrandId(brandId)
        .asCompleted()
        .build();

      expect(campaign.status).toBe("completed");
      expect(campaign.paymentStatus).toBe("paid");
      expect(campaign.remainingBudget).toBe(0);
    });

    test("creates expired campaign", () => {
      const brandId = "brand123" as any;
      const campaign = CampaignBuilder.create()
        .withBrandId(brandId)
        .asExpired()
        .build();

      expect(campaign.endDate).toBeLessThan(Date.now());
    });

    test("throws error without brandId", () => {
      expect(() => {
        CampaignBuilder.create().build();
      }).toThrow("Campaign must have a brandId");
    });
  });

  describe("SubmissionBuilder", () => {
    test("creates submission with defaults", () => {
      const campaignId = "campaign123" as any;
      const creatorId = "creator123" as any;
      const submission = SubmissionBuilder.create()
        .withCampaignId(campaignId)
        .withCreatorId(creatorId)
        .build();

      expect(submission.campaignId).toBe(campaignId);
      expect(submission.creatorId).toBe(creatorId);
      expect(submission.contentUrl).toMatch(
        /https:\/\/www\.tiktok\.com\/@testuser\/video\/\d+/
      );
      expect(submission.status).toBe("pending");
      expect(submission.viewCount).toBe(0);
      expect(submission.initialViewCount).toBe(0);
      expect(submission.viewTrackingEnabled).toBe(true);
    });

    test("creates approved submission", () => {
      const campaignId = "campaign123" as any;
      const creatorId = "creator123" as any;
      const submission = SubmissionBuilder.create()
        .withCampaignId(campaignId)
        .withCreatorId(creatorId)
        .asApproved()
        .build();

      expect(submission.status).toBe("approved");
      expect(submission.approvedAt).toBeDefined();
    });

    test("creates rejected submission", () => {
      const campaignId = "campaign123" as any;
      const creatorId = "creator123" as any;
      const submission = SubmissionBuilder.create()
        .withCampaignId(campaignId)
        .withCreatorId(creatorId)
        .asRejected("Custom rejection reason")
        .build();

      expect(submission.status).toBe("rejected");
      expect(submission.rejectionReason).toBe("Custom rejection reason");
    });

    test("creates high-view submission", () => {
      const campaignId = "campaign123" as any;
      const creatorId = "creator123" as any;
      const submission = SubmissionBuilder.create()
        .withCampaignId(campaignId)
        .withCreatorId(creatorId)
        .withHighViews(75000)
        .build();

      expect(submission.viewCount).toBe(75000);
      expect(submission.thresholdMetAt).toBeDefined();
    });

    test("creates hot tier submission", () => {
      const campaignId = "campaign123" as any;
      const creatorId = "creator123" as any;
      const submission = SubmissionBuilder.create()
        .withCampaignId(campaignId)
        .withCreatorId(creatorId)
        .asHotTier()
        .build();

      expect(submission.monitoringTier).toBe("hot");
      expect(submission.growthRate).toBe(1000);
      expect(submission.lastTierUpdate).toBeDefined();
    });

    test("throws error without campaignId", () => {
      expect(() => {
        SubmissionBuilder.create()
          .withCreatorId("creator123" as any)
          .build();
      }).toThrow("Submission must have a campaignId");
    });

    test("throws error without creatorId", () => {
      expect(() => {
        SubmissionBuilder.create()
          .withCampaignId("campaign123" as any)
          .build();
      }).toThrow("Submission must have a creatorId");
    });
  });

  describe("ViewTrackingBuilder", () => {
    test("creates view tracking with defaults", () => {
      const submissionId = "submission123" as any;
      const viewTracking = ViewTrackingBuilder.create()
        .withSubmissionId(submissionId)
        .build();

      expect(viewTracking.submissionId).toBe(submissionId);
      expect(viewTracking.viewCount).toBe(0);
      expect(viewTracking.timestamp).toBeDefined();
    });

    test("creates view tracking with custom data", () => {
      const submissionId = "submission123" as any;
      const timestamp = Date.now() - 86400000;
      const viewTracking = ViewTrackingBuilder.create()
        .withSubmissionId(submissionId)
        .withViewCount(15000)
        .withTimestamp(timestamp)

        .withMetadata({ additionalInfo: "test" })
        .build();

      expect(viewTracking.viewCount).toBe(15000);
      expect(viewTracking.timestamp).toBe(timestamp);

      expect(viewTracking.metadata).toEqual({ additionalInfo: "test" });
    });

    test("throws error without submissionId", () => {
      expect(() => {
        ViewTrackingBuilder.create().build();
      }).toThrow("ViewTracking must have a submissionId");
    });
  });

  describe("PaymentBuilder", () => {
    test("creates payment with defaults", () => {
      const userId = "user123" as any;
      const payment = PaymentBuilder.create().withUserId(userId).build();

      expect(payment.userId).toBe(userId);
      expect(payment.type).toBe("creator_payout");
      expect(payment.amount).toBe(1000);
      expect(payment.status).toBe("pending");
      expect(payment.createdAt).toBeDefined();
    });

    test("creates campaign payment", () => {
      const userId = "user123" as any;
      const campaignId = "campaign123" as any;
      const payment = PaymentBuilder.create()
        .withUserId(userId)
        .withCampaignId(campaignId)
        .asCampaignPayment()
        .withAmount(50000)
        .withStripePaymentIntentId("pi_test123")
        .build();

      expect(payment.type).toBe("campaign_payment");
      expect(payment.status).toBe("completed");
      expect(payment.campaignId).toBe(campaignId);
      expect(payment.amount).toBe(50000);
      expect(payment.stripePaymentIntentId).toBe("pi_test123");
    });

    test("creates creator payout", () => {
      const userId = "user123" as any;
      const payment = PaymentBuilder.create()
        .withUserId(userId)
        .asCreatorPayout()
        .withAmount(2500)
        .withStripeTransferId("tr_test123")
        .withMetadata({
          submissionIds: ["sub1" as any, "sub2" as any],
          transferAmount: 2375,
          platformFee: 125,
          stripeFee: 100,
        })
        .build();

      expect(payment.type).toBe("creator_payout");
      expect(payment.status).toBe("pending");
      expect(payment.amount).toBe(2500);
      expect(payment.stripeTransferId).toBe("tr_test123");
      expect(payment.metadata?.submissionIds).toHaveLength(2);
      expect(payment.metadata?.platformFee).toBe(125);
    });

    test("throws error without userId", () => {
      expect(() => {
        PaymentBuilder.create().build();
      }).toThrow("Payment must have a userId");
    });
  });

  describe("ScenarioBuilder", () => {
    test("creates brand with campaign scenario", () => {
      const scenario = ScenarioBuilder.create().createBrandWithCampaign({
        brandEmail: "test-brand@example.com",
        companyName: "Test Brand Inc",
        campaignTitle: "Summer Campaign",
        campaignStatus: "active",
        budget: 25000,
      });

      expect(scenario.brand.email).toBe("test-brand@example.com");
      expect(scenario.brandProfile.companyName).toBe("Test Brand Inc");
      expect(scenario.brandProfile.userId).toBe(scenario.brand._id);
      expect(scenario.campaign.title).toBe("Summer Campaign");
      expect(scenario.campaign.status).toBe("active");
      expect(scenario.campaign.totalBudget).toBe(25000);
      expect(scenario.campaign.brandId).toBe(scenario.brand._id);
    });

    test("creates creator with submission scenario", () => {
      const campaignId = "campaign123" as any;
      const scenario = ScenarioBuilder.create().createCreatorWithSubmission(
        campaignId,
        {
          creatorEmail: "test-creator@example.com",
          tiktokUsername: "@testcreator",
          submissionStatus: "approved",
          viewCount: 15000,
        }
      );

      expect(scenario.creator.email).toBe("test-creator@example.com");
      expect(scenario.creatorProfile.tiktokUsername).toBe("@testcreator");
      expect(scenario.creatorProfile.userId).toBe(scenario.creator._id);
      expect(scenario.submission.campaignId).toBe(campaignId);
      expect(scenario.submission.creatorId).toBe(scenario.creator._id);
      expect(scenario.submission.status).toBe("approved");
      expect(scenario.submission.viewCount).toBe(15000);
    });

    test("creates complete campaign lifecycle scenario", () => {
      const scenario =
        ScenarioBuilder.create().createCampaignLifecycleScenario();

      // Check brand and campaign
      expect(scenario.brand.user).toBeDefined();
      expect(scenario.brand.profile).toBeDefined();
      expect(scenario.campaign).toBeDefined();
      expect(scenario.campaign.brandId).toBe(scenario.brand.user._id);

      // Check creators and submissions
      expect(scenario.creators).toHaveLength(3);
      expect(scenario.creators[0].submission.status).toBe("approved");
      expect(scenario.creators[1].submission.status).toBe("pending");
      expect(scenario.creators[2].submission.status).toBe("rejected");

      // Check all submissions belong to the campaign
      scenario.creators.forEach((creator) => {
        expect(creator.submission.campaignId).toBe(scenario.campaign._id);
        expect(creator.submission.creatorId).toBe(creator.user._id);
        expect(creator.profile.userId).toBe(creator.user._id);
      });

      // Check view tracking
      expect(scenario.viewTracking).toHaveLength(2);
      expect(scenario.viewTracking[0].submissionId).toBe(
        scenario.creators[0].submission._id
      );
      expect(scenario.viewTracking[1].submissionId).toBe(
        scenario.creators[0].submission._id
      );
    });
  });

  describe("TestDataFactory helper functions", () => {
    test("creates brand quickly", () => {
      const { user, profile } = TestDataFactory.createBrand(
        "brand@test.com",
        "Quick Brand"
      );

      expect(user.email).toBe("brand@test.com");
      expect(profile.companyName).toBe("Quick Brand");
      expect(profile.userType).toBe("brand");
      expect(profile.userId).toBe(user._id);
    });

    test("creates creator quickly", () => {
      const { user, profile } = TestDataFactory.createCreator(
        "creator@test.com",
        "@quickcreator"
      );

      expect(user.email).toBe("creator@test.com");
      expect(profile.tiktokUsername).toBe("@quickcreator");
      expect(profile.userType).toBe("creator");
      expect(profile.userId).toBe(user._id);
    });

    test("resets ID counter", () => {
      const user1 = UserBuilder.create().build();
      TestDataFactory.resetIdCounter();
      const user2 = UserBuilder.create().build();

      // IDs should start fresh after reset
      expect(user1._id).toMatch(/users_1000/);
      expect(user2._id).toMatch(/users_1000/);
    });
  });

  describe("Realistic data relationships", () => {
    test("maintains referential integrity", () => {
      const { brand, brandProfile, campaign } =
        ScenarioBuilder.create().createBrandWithCampaign();
      const { creator, creatorProfile, submission } =
        ScenarioBuilder.create().createCreatorWithSubmission(campaign._id);

      // Verify relationships
      expect(brandProfile.userId).toBe(brand._id);
      expect(campaign.brandId).toBe(brand._id);
      expect(creatorProfile.userId).toBe(creator._id);
      expect(submission.campaignId).toBe(campaign._id);
      expect(submission.creatorId).toBe(creator._id);
    });

    test("creates realistic monetary values", () => {
      const campaign = CampaignBuilder.create()
        .withBrandId("brand123" as any)
        .withBudget(50000, 30000) // €500 total, €300 remaining
        .withCpmRate(750) // €7.50 CPM
        .withMaxPayout(5000) // €50 max
        .build();

      expect(campaign.totalBudget).toBe(50000);
      expect(campaign.remainingBudget).toBe(30000);
      expect(campaign.cpmRate).toBe(750);
      expect(campaign.maxPayoutPerSubmission).toBe(5000);
    });

    test("creates realistic view progression", () => {
      const submissionId = "submission123" as any;
      const viewHistory = [
        ViewTrackingBuilder.create()
          .withSubmissionId(submissionId)
          .withViewCount(1000)
          .withTimestamp(Date.now() - 172800000) // 2 days ago

          .build(),
        ViewTrackingBuilder.create()
          .withSubmissionId(submissionId)
          .withViewCount(5000)
          .withTimestamp(Date.now() - 86400000) // 1 day ago

          .build(),
        ViewTrackingBuilder.create()
          .withSubmissionId(submissionId)
          .withViewCount(12000)
          .withTimestamp(Date.now())

          .build(),
      ];

      // Verify progression
      expect(viewHistory[0].viewCount).toBeLessThan(viewHistory[1].viewCount);
      expect(viewHistory[1].viewCount).toBeLessThan(viewHistory[2].viewCount);
      expect(viewHistory[0].timestamp).toBeLessThan(viewHistory[1].timestamp);
      expect(viewHistory[1].timestamp).toBeLessThan(viewHistory[2].timestamp);
    });
  });
});
