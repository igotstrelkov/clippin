/**
 * Approval Workflow Orchestrator
 * Handles submission approval/rejection process with proper error handling and testability
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
  canUpdateSubmissionStatus,
  validateStatusTransition,
  prepareSubmissionUpdate,
  type SubmissionUpdateArgs,
  type SubmissionStatus,
} from "../submissionService";
import { logger } from "../../logger";

// Input types for the approval workflow
export interface ApprovalWorkflowInput {
  submissionId: Id<"submissions">;
  status: SubmissionStatus;
  rejectionReason?: string;
}

export interface ApprovalWorkflowData {
  submission: Doc<"submissions"> | null;
  campaign: Doc<"campaigns"> | null;
  creator: Doc<"users"> | null;
  creatorProfile: Doc<"profiles"> | null;
  brandProfile: Doc<"profiles"> | null;
  updates: Partial<Doc<"submissions">>;
}

/**
 * Approval Workflow Implementation
 * Orchestrates the submission approval/rejection process
 */
export class ApprovalWorkflow extends BaseWorkflowOrchestrator {
  private input: ApprovalWorkflowInput;
  private data: ApprovalWorkflowData;

  constructor(ctx: WorkflowContext, userId: Id<"users">, input: ApprovalWorkflowInput) {
    super(ctx, userId);
    this.input = input;
    this.data = {
      submission: null,
      campaign: null,
      creator: null,
      creatorProfile: null,
      brandProfile: null,
      updates: {}
    };
  }

  protected async validatePreconditions(): Promise<StepResult<void>> {
    return this.executeStep(
      "validatePreconditions",
      async () => {
        if (!this.userId) {
          throw new Error("User must be authenticated");
        }
        if (!this.input.submissionId) {
          throw new Error("Submission ID is required");
        }
        if (!this.input.status) {
          throw new Error("Status is required");
        }
        if (this.input.status === "rejected" && !this.input.rejectionReason) {
          throw new Error("Rejection reason is required for rejected submissions");
        }
      },
      null
    );
  }

  protected async executeWorkflow(): Promise<WorkflowResult> {
    // Step 1: Load required data
    await this.loadRequiredData();
    
    // Step 2: Validate permissions
    await this.validatePermissions();
    
    // Step 3: Validate status transition
    await this.validateStatusTransition();
    
    // Step 4: Prepare updates
    await this.prepareUpdates();
    
    // Step 5: Update campaign statistics
    await this.updateCampaignStats();
    
    // Step 6: Update submission record
    await this.updateSubmissionRecord();
    
    // Step 7: Send status notifications (non-blocking)
    await this.sendStatusNotifications();

    return WorkflowUtils.success({
      submissionId: this.input.submissionId,
      status: this.input.status,
      message: `Submission ${this.input.status} successfully`
    });
  }

  /**
   * Step 1: Load required data
   */
  private async loadRequiredData(): Promise<StepResult> {
    return this.executeStep(
      "loadRequiredData",
      async () => {
        // Load submission
        this.data.submission = await this.ctx.db.get(this.input.submissionId);
        if (!this.data.submission) {
          throw new Error("Submission not found");
        }

        // Load campaign
        this.data.campaign = await this.ctx.db.get(this.data.submission.campaignId);
        if (!this.data.campaign) {
          throw new Error("Campaign not found");
        }

        // Load creator user and profile
        this.data.creator = await this.ctx.db.get(this.data.submission.creatorId);
        this.data.creatorProfile = await this.ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q: any) => q.eq("userId", this.data.submission?.creatorId))
          .unique();

        // Load brand profile
        this.data.brandProfile = await this.ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q: any) => q.eq("userId", this.data.campaign?.brandId))
          .unique();

        return {
          submission: !!this.data.submission,
          campaign: !!this.data.campaign,
          creator: !!this.data.creator,
          creatorProfile: !!this.data.creatorProfile,
          brandProfile: !!this.data.brandProfile
        };
      },
      null
    );
  }

  /**
   * Step 2: Validate permissions
   */
  private async validatePermissions(): Promise<StepResult> {
    return this.executeStep(
      "validatePermissions",
      async () => {
        if (!this.data.submission || !this.data.campaign) {
          throw new Error("Required data not loaded");
        }

        const permissionCheck = canUpdateSubmissionStatus(
          this.data.submission,
          this.data.campaign,
          this.userId
        );

        if (!permissionCheck.hasPermission) {
          throw new Error(
            permissionCheck.reason || "Not authorized to update this submission"
          );
        }

        return { authorized: true };
      },
      null
    );
  }

  /**
   * Step 3: Validate status transition
   */
  private async validateStatusTransition(): Promise<StepResult> {
    return this.executeStep(
      "validateStatusTransition",
      async () => {
        if (!this.data.submission) {
          throw new Error("Submission not loaded");
        }

        const transitionValidation = validateStatusTransition(
          this.data.submission.status,
          this.input.status
        );

        if (!transitionValidation.isValid) {
          throw new Error(
            transitionValidation.error || "Invalid status transition"
          );
        }

        return { validTransition: true };
      },
      null
    );
  }

  /**
   * Step 4: Prepare updates
   */
  private async prepareUpdates(): Promise<StepResult> {
    return this.executeStep(
      "prepareUpdates",
      async () => {
        const updateArgs: SubmissionUpdateArgs = {
          status: this.input.status,
          rejectionReason: this.input.rejectionReason,
        };

        this.data.updates = prepareSubmissionUpdate(updateArgs, this.input.status);

        return { updatesReady: true, updateCount: Object.keys(this.data.updates).length };
      },
      null
    );
  }

  /**
   * Step 5: Update campaign statistics
   */
  private async updateCampaignStats(): Promise<StepResult> {
    return this.executeStep(
      "updateCampaignStats",
      async () => {
        if (!this.data.campaign) {
          throw new Error("Campaign not loaded");
        }

        // Only update stats if approving
        if (this.input.status === "approved" && this.data.submission && this.data.campaign) {
          await this.ctx.db.patch(this.data.submission.campaignId, {
            approvedSubmissions: (this.data.campaign.approvedSubmissions || 0) + 1,
          });
          return { statsUpdated: true, type: "approval" };
        }

        return { statsUpdated: false, type: "no_change" };
      },
      null,
      { required: false, retries: 2 } // Non-critical step
    );
  }

  /**
   * Step 6: Update submission record
   */
  private async updateSubmissionRecord(): Promise<StepResult> {
    return this.executeStep(
      "updateSubmissionRecord",
      async () => {
        await this.ctx.db.patch(this.input.submissionId, this.data.updates);

        return { 
          updated: true, 
          status: this.input.status,
          fieldsUpdated: Object.keys(this.data.updates)
        };
      },
      null
    );
  }

  /**
   * Step 7: Send status notifications (non-blocking)
   */
  private async sendStatusNotifications(): Promise<StepResult> {
    return this.executeStep(
      "sendStatusNotifications",
      async () => {
        if (!this.data.creator?.email || !this.data.creatorProfile || !this.data.brandProfile || !this.data.campaign) {
          return { sent: false, reason: "Missing required data for notifications" };
        }

        try {
          if (this.input.status === "approved") {
            await this.ctx.scheduler.runAfter(
              0,
              internal.emails.sendApprovalNotification,
              {
                creatorEmail: this.data.creator.email,
                creatorName: this.data.creatorProfile.creatorName || "Creator",
                campaignTitle: this.data.campaign.title,
                brandName: this.data.brandProfile.companyName || "Brand",
                earnings: (this.data.updates.earnings || 0) / 100,
                viewCount: this.data.submission!.viewCount || 0,
              }
            );
            return { sent: true, type: "approval" };

          } else if (this.input.status === "rejected" && this.input.rejectionReason) {
            await this.ctx.scheduler.runAfter(
              0,
              internal.emails.sendRejectionNotification,
              {
                creatorEmail: this.data.creator.email,
                creatorName: this.data.creatorProfile.creatorName || "Creator",
                campaignTitle: this.data.campaign.title,
                brandName: this.data.brandProfile.companyName || "Brand",
                rejectionReason: this.input.rejectionReason,
                tiktokUrl: this.data.submission?.tiktokUrl || "",
              }
            );
            return { sent: true, type: "rejection" };
          }

          return { sent: false, reason: "No notification needed for this status" };

        } catch (error) {
          logger.error("Failed to send status notification email", {
            submissionId: this.input.submissionId,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          
          // Don't fail the workflow for notification errors
          return { 
            sent: false, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      },
      null,
      { required: false } // Non-critical step
    );
  }

  /**
   * Get approval-specific result data
   */
  public getApprovalData() {
    return {
      submissionId: this.input.submissionId,
      status: this.input.status,
      rejectionReason: this.input.rejectionReason,
      campaignId: this.data.submission?.campaignId,
      creatorId: this.data.submission?.creatorId,
    };
  }
}

/**
 * Factory function to create and execute approval workflow
 */
export async function executeApprovalWorkflow(
  ctx: WorkflowContext,
  userId: Id<"users">,
  input: ApprovalWorkflowInput
): Promise<WorkflowResult> {
  const workflow = new ApprovalWorkflow(ctx, userId, input);
  return await workflow.execute();
}

/**
 * Utility to create approval workflow for testing
 */
export function createApprovalWorkflow(
  ctx: WorkflowContext,
  userId: Id<"users">,
  input: ApprovalWorkflowInput
): ApprovalWorkflow {
  return new ApprovalWorkflow(ctx, userId, input);
}