/**
 * Submission Workflow Orchestrator
 * Handles the complex submission creation process with proper error handling and testability
 */

import { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { 
  BaseWorkflowOrchestrator, 
  WorkflowContext, 
  WorkflowResult, 
  StepResult,
  WorkflowUtils 
} from "../workflowOrchestrator";
import {
  validateCreatorEligibility,
  validateSubmissionData,
  checkUrlDuplication,
  prepareSubmissionCreation,
  type SubmissionCreationArgs,
} from "../submissionService";
import { logger } from "../../logger";

// Input types for the submission workflow
export interface SubmissionWorkflowInput {
  campaignId: Id<"campaigns">;
  tiktokUrl: string;
}

export interface SubmissionWorkflowData {
  profile: Doc<"profiles"> | null;
  campaign: Doc<"campaigns"> | null;
  submissionArgs: SubmissionCreationArgs;
  submissionId?: Id<"submissions">;
  brandProfile?: Doc<"profiles"> | null;
}

/**
 * Submission Workflow Implementation
 * Orchestrates the entire submission creation process
 */
export class SubmissionWorkflow extends BaseWorkflowOrchestrator {
  private input: SubmissionWorkflowInput;
  private data: SubmissionWorkflowData;

  constructor(ctx: WorkflowContext, userId: Id<"users">, input: SubmissionWorkflowInput) {
    super(ctx, userId);
    this.input = input;
    this.data = {
      profile: null,
      campaign: null,
      submissionArgs: {
        campaignId: input.campaignId,
        creatorId: userId,
        tiktokUrl: input.tiktokUrl,
      }
    };
  }

  protected async validatePreconditions(): Promise<StepResult<void>> {
    return this.executeStep(
      "validatePreconditions",
      async () => {
        if (!this.userId) {
          throw new Error("User must be authenticated");
        }
        if (!this.input.campaignId) {
          throw new Error("Campaign ID is required");
        }
        if (!this.input.tiktokUrl?.trim()) {
          throw new Error("TikTok URL is required");
        }
      },
      null
    );
  }

  protected async executeWorkflow(): Promise<WorkflowResult> {
    // Step 1: Load required data
    await this.loadRequiredData();
    
    // Step 2: Validate creator eligibility
    await this.validateEligibility();
    
    // Step 3: Verify TikTok post ownership
    await this.verifyPostOwnership();
    
    // Step 4: Check for URL duplication
    await this.checkUrlDuplication();
    
    // Step 5: Create submission record
    await this.createSubmission();
    
    // Step 6: Schedule view tracking
    await this.scheduleViewTracking();
    
    // Step 7: Update campaign statistics
    await this.updateCampaignStats();
    
    // Step 8: Update creator statistics
    await this.updateCreatorStats();
    
    // Step 9: Send notifications (non-blocking)
    await this.sendNotifications();

    return WorkflowUtils.success({
      submissionId: this.data.submissionId,
      message: "Submission successful! Awaiting brand approval."
    });
  }

  /**
   * Step 1: Load required data (user profile and campaign)
   */
  private async loadRequiredData(): Promise<StepResult> {
    return this.executeStep(
      "loadRequiredData",
      async () => {
        // Load user profile
        this.data.profile = await this.ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q: any) => q.eq("userId", this.userId))
          .unique();

        // Load campaign
        this.data.campaign = await this.ctx.db.get(this.input.campaignId);

        return { profile: !!this.data.profile, campaign: !!this.data.campaign };
      },
      null
    );
  }

  /**
   * Step 2: Validate creator eligibility
   */
  private async validateEligibility(): Promise<StepResult> {
    return this.executeStep(
      "validateEligibility",
      async () => {
        const eligibilityValidation = validateCreatorEligibility(
          this.data.profile, 
          this.data.campaign
        );

        if (!eligibilityValidation.isValid) {
          throw new Error(eligibilityValidation.errors[0]);
        }

        const dataValidation = validateSubmissionData(this.data.submissionArgs);
        if (!dataValidation.isValid) {
          throw new Error(dataValidation.errors[0]);
        }

        return { eligible: true };
      },
      null
    );
  }

  /**
   * Step 3: Verify TikTok post ownership
   */
  private async verifyPostOwnership(): Promise<StepResult> {
    return this.executeStep(
      "verifyPostOwnership",
      async () => {
        const isPostVerified = this.ctx.runQuery 
          ? await this.ctx.runQuery(
              internal.profiles.verifyPost,
              { postUrl: this.input.tiktokUrl }
            )
          : true; // Default to true if runQuery is not available

        if (!isPostVerified) {
          throw new Error("Post does not belong to your verified TikTok account");
        }

        return { verified: true };
      },
      null
    );
  }

  /**
   * Step 4: Check for URL duplication
   */
  private async checkUrlDuplication(): Promise<StepResult> {
    return this.executeStep(
      "checkUrlDuplication",
      async () => {
        const existingUrlSubmission = await this.ctx.db
          .query("submissions")
          .filter((q: any) => q.eq(q.field("tiktokUrl"), this.input.tiktokUrl.trim()))
          .first();

        const duplicationCheck = checkUrlDuplication(
          this.input.tiktokUrl,
          existingUrlSubmission
        );

        if (!duplicationCheck.isValid) {
          throw new Error(duplicationCheck.errors[0]);
        }

        return { unique: true };
      },
      null
    );
  }

  /**
   * Step 5: Create submission record
   */
  private async createSubmission(): Promise<StepResult> {
    return this.executeStep(
      "createSubmission",
      async () => {
        const initialViews = 0;
        const submissionData = prepareSubmissionCreation(
          this.data.submissionArgs,
          initialViews
        );

        this.data.submissionId = await this.ctx.db.insert("submissions", submissionData);

        // Log initial view tracking entry if needed
        if (initialViews > 0) {
          await this.ctx.db.insert("viewTracking", {
            submissionId: this.data.submissionId,
            viewCount: initialViews,
            timestamp: Date.now(),
            source: "submission_initial",
          });
        }

        return { submissionId: this.data.submissionId };
      },
      null
    );
  }

  /**
   * Step 6: Schedule view tracking
   */
  private async scheduleViewTracking(): Promise<StepResult> {
    return this.executeStep(
      "scheduleViewTracking",
      async () => {
        if (!this.data.submissionId) {
          throw new Error("Submission ID not available");
        }

        await this.ctx.scheduler.runAfter(
          0,
          internal.viewTracking.getInitialViewCount,
          {
            tiktokUrl: this.input.tiktokUrl.trim(),
            submissionId: this.data.submissionId,
          }
        );

        return { scheduled: true };
      },
      null,
      { required: false, retries: 2 } // Non-critical step
    );
  }

  /**
   * Step 7: Update campaign statistics
   */
  private async updateCampaignStats(): Promise<StepResult> {
    return this.executeStep(
      "updateCampaignStats",
      async () => {
        if (!this.data.campaign) {
          throw new Error("Campaign not available");
        }

        await this.ctx.db.patch(this.input.campaignId, {
          totalSubmissions: (this.data.campaign.totalSubmissions || 0) + 1,
        });

        return { updated: true };
      },
      null,
      { required: false, retries: 2 } // Non-critical step
    );
  }

  /**
   * Step 8: Update creator statistics
   */
  private async updateCreatorStats(): Promise<StepResult> {
    return this.executeStep(
      "updateCreatorStats",
      async () => {
        if (!this.data.profile) {
          throw new Error("Profile not available");
        }

        await this.ctx.db.patch(this.data.profile._id, {
          totalSubmissions: (this.data.profile.totalSubmissions || 0) + 1,
        });

        return { updated: true };
      },
      null,
      { required: false, retries: 2 } // Non-critical step
    );
  }

  /**
   * Step 9: Send notifications (non-blocking)
   */
  private async sendNotifications(): Promise<StepResult> {
    return this.executeStep(
      "sendNotifications",
      async () => {
        if (!this.data.campaign) {
          throw new Error("Campaign not available for notifications");
        }

        try {
          const brandUser = await this.ctx.db.get(this.data.campaign.brandId);
          this.data.brandProfile = await this.ctx.db
            .query("profiles")
            .withIndex("by_user_id", (q: any) => q.eq("userId", this.data.campaign?.brandId))
            .unique();

          if (brandUser?.email && this.data.brandProfile?.companyName && this.data.profile) {
            await this.ctx.scheduler.runAfter(
              0,
              internal.emails.sendSubmissionNotification,
              {
                brandEmail: brandUser.email,
                brandName: this.data.brandProfile.companyName,
                campaignTitle: this.data.campaign.title,
                creatorName: this.data.profile.creatorName || "Unknown Creator",
                tiktokUrl: this.input.tiktokUrl,
              }
            );
          }

          return { sent: true };
        } catch (error) {
          logger.error("Failed to schedule submission notification", {
            submissionId: this.data.submissionId,
            campaignId: this.data.campaign?._id,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          
          // Don't fail the workflow for notification errors
          return { sent: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      null,
      { required: false } // Non-critical step
    );
  }

  /**
   * Get submission-specific result data
   */
  public getSubmissionData() {
    return {
      submissionId: this.data.submissionId,
      campaignId: this.input.campaignId,
      creatorId: this.userId,
      tiktokUrl: this.input.tiktokUrl,
    };
  }
}

/**
 * Factory function to create and execute submission workflow
 */
export async function executeSubmissionWorkflow(
  ctx: WorkflowContext,
  userId: Id<"users">,
  input: SubmissionWorkflowInput
): Promise<WorkflowResult> {
  const workflow = new SubmissionWorkflow(ctx, userId, input);
  return await workflow.execute();
}

/**
 * Utility to create submission workflow for testing
 */
export function createSubmissionWorkflow(
  ctx: WorkflowContext,
  userId: Id<"users">,
  input: SubmissionWorkflowInput
): SubmissionWorkflow {
  return new SubmissionWorkflow(ctx, userId, input);
}