/**
 * Test Data Factory System
 * Provides builder pattern for creating realistic test data with proper relationships
 */

import { Doc, Id, TableNames } from "../../convex/_generated/dataModel";

// Helper to generate mock IDs
let idCounter = 1000;
function generateId<T extends TableNames>(prefix: T): Id<T> {
  return `${prefix}_${idCounter++}` as Id<T>;
}

// Base builder interface
interface Builder<T> {
  build(): T;
}

// User Builder
export class UserBuilder implements Builder<Doc<"users">> {
  private data: Partial<Doc<"users">> = {};

  static create(): UserBuilder {
    return new UserBuilder();
  }

  withEmail(email: string): UserBuilder {
    this.data.email = email;
    return this;
  }

  withName(name: string): UserBuilder {
    this.data.name = name;
    return this;
  }

  build(): Doc<"users"> {
    return {
      _id: generateId("users"),
      _creationTime: Date.now(),
      email: this.data.email || `user${idCounter}@test.com`,
      name: this.data.name || `Test User ${idCounter}`,
      ...this.data,
    };
  }
}

// Profile Builder
export class ProfileBuilder implements Builder<Doc<"profiles">> {
  private data: Partial<Doc<"profiles">> = {};

  static create(): ProfileBuilder {
    return new ProfileBuilder();
  }

  withUserId(userId: Id<"users">): ProfileBuilder {
    this.data.userId = userId;
    return this;
  }

  asCreator(): ProfileBuilder {
    this.data.userType = "creator";
    this.data.creatorName = this.data.creatorName || `TestCreator${idCounter}`;
    this.data.tiktokUsername =
      this.data.tiktokUsername || `@testcreator${idCounter}`;
    this.data.tiktokVerified = this.data.tiktokVerified ?? true;
    this.data.totalEarnings = this.data.totalEarnings ?? 0;
    this.data.totalSubmissions = this.data.totalSubmissions ?? 0;
    return this;
  }

  asBrand(): ProfileBuilder {
    this.data.userType = "brand";
    this.data.companyName =
      this.data.companyName || `Test Company ${idCounter}`;
    return this;
  }

  withCreatorName(creatorName: string): ProfileBuilder {
    this.data.creatorName = creatorName;
    return this;
  }

  withTikTokUsername(username: string): ProfileBuilder {
    this.data.tiktokUsername = username;
    return this;
  }

  withTikTokVerified(verified: boolean): ProfileBuilder {
    this.data.tiktokVerified = verified;
    return this;
  }

  withTotalEarnings(earnings: number): ProfileBuilder {
    this.data.totalEarnings = earnings;
    return this;
  }

  withCompanyName(companyName: string): ProfileBuilder {
    this.data.companyName = companyName;
    return this;
  }

  withStripeCustomerId(customerId: string): ProfileBuilder {
    this.data.stripeCustomerId = customerId;
    return this;
  }

  build(): Doc<"profiles"> {
    if (!this.data.userId) {
      throw new Error("Profile must have a userId. Use withUserId() method.");
    }

    return {
      _id: generateId("profiles"),
      _creationTime: Date.now(),
      userId: this.data.userId,
      userType: this.data.userType || "creator",
      ...this.data,
    };
  }
}

// Campaign Builder
export class CampaignBuilder implements Builder<Doc<"campaigns">> {
  private data: Partial<Doc<"campaigns">> = {};

  static create(): CampaignBuilder {
    return new CampaignBuilder();
  }

  withBrandId(brandId: Id<"users">): CampaignBuilder {
    this.data.brandId = brandId;
    return this;
  }

  withTitle(title: string): CampaignBuilder {
    this.data.title = title;
    return this;
  }

  withDescription(description: string): CampaignBuilder {
    this.data.description = description;
    return this;
  }

  withCategory(category: string): CampaignBuilder {
    this.data.category = category;
    return this;
  }

  withBudget(totalBudget: number, remainingBudget?: number): CampaignBuilder {
    this.data.totalBudget = totalBudget;
    this.data.remainingBudget = remainingBudget ?? totalBudget;
    return this;
  }

  withCpmRate(cpmRate: number): CampaignBuilder {
    this.data.cpmRate = cpmRate;
    return this;
  }

  withMaxPayout(maxPayout: number): CampaignBuilder {
    this.data.maxPayoutPerSubmission = maxPayout;
    return this;
  }

  withStatus(
    status: "draft" | "active" | "paused" | "completed"
  ): CampaignBuilder {
    this.data.status = status;
    return this;
  }

  withPaymentStatus(
    paymentStatus: "pending" | "paid" | "failed"
  ): CampaignBuilder {
    this.data.paymentStatus = paymentStatus;
    return this;
  }

  withEndDate(endDate: number): CampaignBuilder {
    this.data.endDate = endDate;
    return this;
  }

  withAssetLinks(assetLinks: string[]): CampaignBuilder {
    this.data.assetLinks = assetLinks;
    return this;
  }

  withRequirements(requirements: string[]): CampaignBuilder {
    this.data.requirements = requirements;
    return this;
  }

  withStats(
    totalViews: number,
    totalSubmissions: number,
    approvedSubmissions: number
  ): CampaignBuilder {
    this.data.totalViews = totalViews;
    this.data.totalSubmissions = totalSubmissions;
    this.data.approvedSubmissions = approvedSubmissions;
    return this;
  }

  withStripePaymentIntentId(paymentIntentId: string): CampaignBuilder {
    this.data.stripePaymentIntentId = paymentIntentId;
    return this;
  }

  // Preset configurations for common scenarios
  asDraft(): CampaignBuilder {
    return this.withStatus("draft").withPaymentStatus("pending");
  }

  asActive(): CampaignBuilder {
    return this.withStatus("active").withPaymentStatus("paid");
  }

  asPaused(): CampaignBuilder {
    return this.withStatus("paused").withPaymentStatus("paid");
  }

  asCompleted(): CampaignBuilder {
    return this.withStatus("completed")
      .withPaymentStatus("paid")
      .withBudget(10000, 0);
  }

  asExpired(): CampaignBuilder {
    return this.withEndDate(Date.now() - 86400000); // Yesterday
  }

  build(): Doc<"campaigns"> {
    if (!this.data.brandId) {
      throw new Error(
        "Campaign must have a brandId. Use withBrandId() method."
      );
    }

    return {
      _id: generateId("campaigns"),
      _creationTime: Date.now(),
      brandId: this.data.brandId,
      title: this.data.title || `Test Campaign ${idCounter}`,
      description:
        this.data.description || `Test campaign description ${idCounter}`,
      category: this.data.category || "lifestyle",
      totalBudget: this.data.totalBudget || 10000, // €100
      remainingBudget:
        this.data.remainingBudget ?? this.data.totalBudget ?? 10000,
      cpmRate: this.data.cpmRate || 500, // €5 CPM
      maxPayoutPerSubmission: this.data.maxPayoutPerSubmission || 2500, // €25
      assetLinks: this.data.assetLinks || [],
      requirements: this.data.requirements || [],
      status: this.data.status || "active",
      totalViews: this.data.totalViews || 0,
      totalSubmissions: this.data.totalSubmissions || 0,
      approvedSubmissions: this.data.approvedSubmissions || 0,
      paymentStatus: this.data.paymentStatus || "paid",
      ...this.data,
    };
  }
}

// Submission Builder
export class SubmissionBuilder implements Builder<Doc<"submissions">> {
  private data: Partial<Doc<"submissions">> = {};

  static create(): SubmissionBuilder {
    return new SubmissionBuilder();
  }

  withCampaignId(campaignId: Id<"campaigns">): SubmissionBuilder {
    this.data.campaignId = campaignId;
    return this;
  }

  withCreatorId(creatorId: Id<"users">): SubmissionBuilder {
    this.data.creatorId = creatorId;
    return this;
  }

  withContentUrl(contentUrl: string): SubmissionBuilder {
    this.data.contentUrl = contentUrl;
    return this;
  }

  withStatus(status: "pending" | "approved" | "rejected"): SubmissionBuilder {
    this.data.status = status;
    return this;
  }

  withViewCount(
    viewCount: number,
    initialViewCount?: number
  ): SubmissionBuilder {
    this.data.viewCount = viewCount;
    this.data.initialViewCount = initialViewCount ?? viewCount;
    return this;
  }

  withEarnings(earnings: number, paidOutAmount?: number): SubmissionBuilder {
    this.data.earnings = earnings;
    this.data.paidOutAmount = paidOutAmount ?? 0;
    return this;
  }

  withSubmittedAt(timestamp: number): SubmissionBuilder {
    this.data.submittedAt = timestamp;
    return this;
  }

  withApprovedAt(timestamp: number): SubmissionBuilder {
    this.data.approvedAt = timestamp;
    return this;
  }

  withRejectionReason(reason: string): SubmissionBuilder {
    this.data.rejectionReason = reason;
    this.data.status = "rejected";
    return this;
  }

  withThresholdMet(timestamp: number): SubmissionBuilder {
    this.data.thresholdMetAt = timestamp;
    return this;
  }

  withLastViewUpdate(timestamp: number): SubmissionBuilder {
    this.data.lastViewUpdate = timestamp;
    return this;
  }

  withLastApiCall(timestamp: number): SubmissionBuilder {
    this.data.lastApiCall = timestamp;
    return this;
  }

  withMonitoringTier(
    tier: "hot" | "warm" | "cold" | "archived"
  ): SubmissionBuilder {
    this.data.monitoringTier = tier;
    this.data.lastTierUpdate = Date.now();
    return this;
  }

  withGrowthRate(rate: number): SubmissionBuilder {
    this.data.growthRate = rate;
    return this;
  }

  withViewHistory(
    history: Array<{ timestamp: number; viewCount: number }>
  ): SubmissionBuilder {
    this.data.viewHistory = history;
    return this;
  }

  // Preset configurations
  asPending(): SubmissionBuilder {
    return this.withStatus("pending");
  }

  asApproved(): SubmissionBuilder {
    return this.withStatus("approved").withApprovedAt(Date.now());
  }

  asRejected(reason?: string): SubmissionBuilder {
    return this.withStatus("rejected").withRejectionReason(
      reason || "Does not meet requirements"
    );
  }

  withHighViews(viewCount: number = 50000): SubmissionBuilder {
    return this.withViewCount(viewCount).withThresholdMet(
      Date.now() - 86400000
    );
  }

  asHotTier(): SubmissionBuilder {
    return this.withMonitoringTier("hot").withGrowthRate(1000); // 1000 views/hour
  }

  asWarmTier(): SubmissionBuilder {
    return this.withMonitoringTier("warm").withGrowthRate(100); // 100 views/hour
  }

  asColdTier(): SubmissionBuilder {
    return this.withMonitoringTier("cold").withGrowthRate(10); // 10 views/hour
  }

  asArchivedTier(): SubmissionBuilder {
    return this.withMonitoringTier("archived").withGrowthRate(1); // 1 view/hour
  }

  build(): Doc<"submissions"> {
    if (!this.data.campaignId) {
      throw new Error(
        "Submission must have a campaignId. Use withCampaignId() method."
      );
    }
    if (!this.data.creatorId) {
      throw new Error(
        "Submission must have a creatorId. Use withCreatorId() method."
      );
    }

    return {
      _id: generateId("submissions"),
      _creationTime: Date.now(),
      campaignId: this.data.campaignId,
      platform: this.data.platform || "tiktok",
      creatorId: this.data.creatorId,
      contentUrl:
        this.data.contentUrl ||
        `https://www.tiktok.com/@testuser/video/${Date.now()}`,
      status: this.data.status || "pending",
      viewCount: this.data.viewCount || 0,
      initialViewCount: this.data.initialViewCount || this.data.viewCount || 0,
      submittedAt: this.data.submittedAt || Date.now(),
      viewTrackingEnabled: this.data.viewTrackingEnabled ?? true,
      lastApiCall: this.data.lastApiCall || 0,
      ...this.data,
    };
  }
}

// View Tracking Builder
export class ViewTrackingBuilder implements Builder<Doc<"viewTracking">> {
  private data: Partial<Doc<"viewTracking">> = {};

  static create(): ViewTrackingBuilder {
    return new ViewTrackingBuilder();
  }

  withSubmissionId(submissionId: Id<"submissions">): ViewTrackingBuilder {
    this.data.submissionId = submissionId;
    return this;
  }

  withViewCount(viewCount: number): ViewTrackingBuilder {
    this.data.viewCount = viewCount;
    return this;
  }

  withTimestamp(timestamp: number): ViewTrackingBuilder {
    this.data.timestamp = timestamp;
    return this;
  }

  withMetadata(metadata: object): ViewTrackingBuilder {
    this.data.metadata = metadata;
    return this;
  }

  build(): Doc<"viewTracking"> {
    if (!this.data.submissionId) {
      throw new Error(
        "ViewTracking must have a submissionId. Use withSubmissionId() method."
      );
    }

    return {
      _id: generateId("viewTracking"),
      _creationTime: Date.now(),
      submissionId: this.data.submissionId,
      viewCount: this.data.viewCount || 0,
      timestamp: this.data.timestamp || Date.now(),

      ...this.data,
    };
  }
}

// Payment Builder
export class PaymentBuilder implements Builder<Doc<"payments">> {
  private data: Partial<Doc<"payments">> = {};

  static create(): PaymentBuilder {
    return new PaymentBuilder();
  }

  withUserId(userId: Id<"users">): PaymentBuilder {
    this.data.userId = userId;
    return this;
  }

  withType(type: "campaign_payment" | "creator_payout"): PaymentBuilder {
    this.data.type = type;
    return this;
  }

  withAmount(amount: number): PaymentBuilder {
    this.data.amount = amount;
    return this;
  }

  withStatus(status: "pending" | "completed" | "failed"): PaymentBuilder {
    this.data.status = status;
    return this;
  }

  withCampaignId(campaignId: Id<"campaigns">): PaymentBuilder {
    this.data.campaignId = campaignId;
    return this;
  }

  withStripePaymentIntentId(paymentIntentId: string): PaymentBuilder {
    this.data.stripePaymentIntentId = paymentIntentId;
    return this;
  }

  withStripeTransferId(transferId: string): PaymentBuilder {
    this.data.stripeTransferId = transferId;
    return this;
  }

  withMetadata(metadata: {
    submissionIds?: Id<"submissions">[];
    transferAmount?: number;
    platformFee?: number;
    stripeFee?: number;
  }): PaymentBuilder {
    this.data.metadata = metadata;
    return this;
  }

  withCreatedAt(timestamp: number): PaymentBuilder {
    this.data.createdAt = timestamp;
    return this;
  }

  // Presets
  asCampaignPayment(): PaymentBuilder {
    return this.withType("campaign_payment").withStatus("completed");
  }

  asCreatorPayout(): PaymentBuilder {
    return this.withType("creator_payout").withStatus("pending");
  }

  build(): Doc<"payments"> {
    if (!this.data.userId) {
      throw new Error("Payment must have a userId. Use withUserId() method.");
    }

    return {
      _id: generateId("payments"),
      _creationTime: Date.now(),
      userId: this.data.userId,
      type: this.data.type || "creator_payout",
      amount: this.data.amount || 1000,
      status: this.data.status || "pending",
      createdAt: this.data.createdAt || Date.now(),
      ...this.data,
    };
  }
}

// Scenario Builder - Creates complete test scenarios with related data
export class ScenarioBuilder {
  static create() {
    return new ScenarioBuilder();
  }

  // Creates a complete brand with campaign scenario
  createBrandWithCampaign(
    overrides: {
      brandEmail?: string;
      companyName?: string;
      campaignTitle?: string;
      campaignStatus?: "draft" | "active" | "paused" | "completed";
      budget?: number;
    } = {}
  ) {
    const brand = UserBuilder.create()
      .withEmail(overrides.brandEmail || "brand@test.com")
      .withName("Test Brand User")
      .build();

    const brandProfile = ProfileBuilder.create()
      .withUserId(brand._id)
      .asBrand()
      .withCompanyName(overrides.companyName || "Test Company")
      .build();

    const campaign = CampaignBuilder.create()
      .withBrandId(brand._id)
      .withTitle(overrides.campaignTitle || "Test Campaign")
      .withStatus(overrides.campaignStatus || "active")
      .withBudget(overrides.budget || 10000)
      .build();

    return { brand, brandProfile, campaign };
  }

  // Creates a complete creator scenario
  createCreatorWithSubmission(
    campaignId: Id<"campaigns">,
    overrides: {
      creatorEmail?: string;
      tiktokUsername?: string;
      submissionStatus?: "pending" | "approved" | "rejected";
      viewCount?: number;
    } = {}
  ) {
    const creator = UserBuilder.create()
      .withEmail(overrides.creatorEmail || "creator@test.com")
      .withName("Test Creator User")
      .build();

    const creatorProfile = ProfileBuilder.create()
      .withUserId(creator._id)
      .asCreator()
      .withTikTokUsername(overrides.tiktokUsername || "@testcreator")
      .build();

    const submission = SubmissionBuilder.create()
      .withCampaignId(campaignId)
      .withCreatorId(creator._id)
      .withStatus(overrides.submissionStatus || "pending")
      .withViewCount(overrides.viewCount || 1000)
      .build();

    return { creator, creatorProfile, submission };
  }

  // Creates a complete campaign lifecycle scenario
  createCampaignLifecycleScenario() {
    // Create brand
    const { brand, brandProfile, campaign } = this.createBrandWithCampaign({
      campaignStatus: "active",
      budget: 50000, // €500
    });

    // Create multiple creators with submissions
    const creator1Scenario = this.createCreatorWithSubmission(campaign._id, {
      creatorEmail: "creator1@test.com",
      tiktokUsername: "@creator1",
      submissionStatus: "approved",
      viewCount: 25000,
    });

    const creator2Scenario = this.createCreatorWithSubmission(campaign._id, {
      creatorEmail: "creator2@test.com",
      tiktokUsername: "@creator2",
      submissionStatus: "pending",
      viewCount: 500,
    });

    const creator3Scenario = this.createCreatorWithSubmission(campaign._id, {
      creatorEmail: "creator3@test.com",
      tiktokUsername: "@creator3",
      submissionStatus: "rejected",
      viewCount: 2000,
    });

    // Create view tracking records for submissions
    const viewTracking = [
      ViewTrackingBuilder.create()
        .withSubmissionId(creator1Scenario.submission._id)
        .withViewCount(15000)
        .withTimestamp(Date.now() - 86400000) // 1 day ago

        .build(),
      ViewTrackingBuilder.create()
        .withSubmissionId(creator1Scenario.submission._id)
        .withViewCount(25000)
        .withTimestamp(Date.now())

        .build(),
    ];

    return {
      brand: { user: brand, profile: brandProfile },
      campaign,
      creators: [
        {
          user: creator1Scenario.creator,
          profile: creator1Scenario.creatorProfile,
          submission: creator1Scenario.submission,
        },
        {
          user: creator2Scenario.creator,
          profile: creator2Scenario.creatorProfile,
          submission: creator2Scenario.submission,
        },
        {
          user: creator3Scenario.creator,
          profile: creator3Scenario.creatorProfile,
          submission: creator3Scenario.submission,
        },
      ],
      viewTracking,
    };
  }
}

// Helper functions for common patterns
export const TestDataFactory = {
  User: UserBuilder,
  Profile: ProfileBuilder,
  Campaign: CampaignBuilder,
  Submission: SubmissionBuilder,
  ViewTracking: ViewTrackingBuilder,
  Payment: PaymentBuilder,
  Scenario: ScenarioBuilder,

  // Quick create functions
  createBrand: (email = "brand@test.com", companyName = "Test Company") => {
    const user = UserBuilder.create().withEmail(email).build();
    const profile = ProfileBuilder.create()
      .withUserId(user._id)
      .asBrand()
      .withCompanyName(companyName)
      .build();
    return { user, profile };
  },

  createCreator: (
    email = "creator@test.com",
    tiktokUsername = "@testcreator"
  ) => {
    const user = UserBuilder.create().withEmail(email).build();
    const profile = ProfileBuilder.create()
      .withUserId(user._id)
      .asCreator()
      .withTikTokUsername(tiktokUsername)
      .build();
    return { user, profile };
  },

  resetIdCounter: () => {
    idCounter = 1000;
  },
};
