/**
 * Base Workflow Orchestrator
 * Provides infrastructure for breaking down complex functions into testable workflows
 */

import { Id } from "../_generated/dataModel";

// Base context interface that all workflows will use
export interface WorkflowContext {
  db: {
    query: any;
    get: any;
    insert: any;
    patch: any;
    delete: any;
    system: any;
  };
  storage: {
    getUrl: any;
  };
  scheduler: {
    runAfter: any;
  };
  runQuery?: any;
  runMutation?: any;
  runAction?: any;
}

// Base result type for all workflow operations
export interface WorkflowResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

// Base step result for workflow steps
export interface StepResult<T = any> extends WorkflowResult<T> {
  stepName: string;
  timestamp: number;
}

// Workflow step function type
export type WorkflowStep<TInput = any, TOutput = any> = (
  input: TInput
) => Promise<StepResult<TOutput>>;

/**
 * Base Workflow Orchestrator class
 * Provides common functionality for all workflow implementations
 */
export abstract class BaseWorkflowOrchestrator {
  protected ctx: WorkflowContext;
  protected userId: Id<"users">;
  protected steps: Array<StepResult> = [];

  constructor(ctx: WorkflowContext, userId: Id<"users">) {
    this.ctx = ctx;
    this.userId = userId;
  }

  /**
   * Execute a workflow step with error handling and logging
   */
  protected async executeStep<TInput, TOutput>(
    stepName: string,
    stepFunction: (input: TInput) => Promise<TOutput>,
    input: TInput,
    options: {
      required?: boolean;
      retries?: number;
      timeout?: number;
    } = {}
  ): Promise<StepResult<TOutput>> {
    const { required = true, retries = 0, timeout = 30000 } = options;
    
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const startTime = Date.now();
        
        // Execute with timeout
        const result = await Promise.race([
          stepFunction(input),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Step ${stepName} timed out`)), timeout)
          )
        ]);

        const stepResult: StepResult<TOutput> = {
          stepName,
          timestamp: Date.now(),
          success: true,
          data: result,
          metadata: {
            duration: Date.now() - startTime,
            attempt: attempt + 1
          }
        };

        this.steps.push(stepResult);
        return stepResult;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;
        
        if (attempt <= retries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All attempts failed
    const stepResult: StepResult<TOutput> = {
      stepName,
      timestamp: Date.now(),
      success: false,
      error: lastError?.message || `Step ${stepName} failed`,
      metadata: {
        attempts: attempt,
        required
      }
    };

    this.steps.push(stepResult);

    if (required) {
      throw new Error(`Required step ${stepName} failed: ${lastError?.message}`);
    }

    return stepResult;
  }

  /**
   * Validate workflow preconditions
   */
  protected abstract validatePreconditions(): Promise<StepResult<void>>;

  /**
   * Execute the main workflow logic
   */
  protected abstract executeWorkflow(): Promise<WorkflowResult>;

  /**
   * Handle workflow cleanup (optional)
   */
  protected async cleanup(): Promise<void> {
    // Override in subclasses if cleanup is needed
  }

  /**
   * Main workflow execution method
   */
  public async execute(): Promise<WorkflowResult> {
    try {
      // Validate preconditions
      const preconditionResult = await this.validatePreconditions();
      if (!preconditionResult.success) {
        return {
          success: false,
          error: `Precondition failed: ${preconditionResult.error}`,
          metadata: { steps: this.steps }
        };
      }

      // Execute main workflow
      const result = await this.executeWorkflow();
      
      // Add workflow metadata
      result.metadata = {
        ...result.metadata,
        steps: this.steps,
        totalSteps: this.steps.length,
        successfulSteps: this.steps.filter(s => s.success).length,
        executionTime: this.steps.reduce((total, step) => 
          total + (step.metadata?.duration || 0), 0
        )
      };

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage,
        metadata: {
          steps: this.steps,
          totalSteps: this.steps.length,
          successfulSteps: this.steps.filter(s => s.success).length
        }
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Get workflow execution summary
   */
  public getExecutionSummary() {
    return {
      totalSteps: this.steps.length,
      successfulSteps: this.steps.filter(s => s.success).length,
      failedSteps: this.steps.filter(s => !s.success).length,
      executionTime: this.steps.reduce((total, step) => 
        total + (step.metadata?.duration || 0), 0
      ),
      steps: this.steps.map(step => ({
        name: step.stepName,
        success: step.success,
        duration: step.metadata?.duration,
        error: step.error
      }))
    };
  }
}

/**
 * Workflow builder for creating reusable workflow steps
 */
export class WorkflowBuilder<T = any> {
  private steps: Array<{
    name: string;
    fn: WorkflowStep<any, any>;
    required: boolean;
    retries: number;
  }> = [];

  addStep<TInput, TOutput>(
    name: string,
    fn: (input: TInput) => Promise<TOutput>,
    options: { required?: boolean; retries?: number } = {}
  ): WorkflowBuilder<T> {
    this.steps.push({
      name,
      fn: async (input) => ({
        stepName: name,
        timestamp: Date.now(),
        success: true,
        data: await fn(input)
      }),
      required: options.required ?? true,
      retries: options.retries ?? 0
    });
    return this;
  }

  build() {
    return this.steps;
  }
}

/**
 * Utility functions for workflow operations
 */
export const WorkflowUtils = {
  /**
   * Create a workflow result
   */
  success<T>(data: T, metadata?: Record<string, any>): WorkflowResult<T> {
    return { success: true, data, metadata };
  },

  /**
   * Create a failure result
   */
  failure(error: string, metadata?: Record<string, any>): WorkflowResult {
    return { success: false, error, metadata };
  },

  /**
   * Check if all required steps completed successfully
   */
  allRequiredStepsSucceeded(steps: StepResult[]): boolean {
    return steps
      .filter(step => step.metadata?.required !== false)
      .every(step => step.success);
  },

  /**
   * Get failed steps
   */
  getFailedSteps(steps: StepResult[]): StepResult[] {
    return steps.filter(step => !step.success);
  },

  /**
   * Get step by name
   */
  getStep(steps: StepResult[], name: string): StepResult | undefined {
    return steps.find(step => step.stepName === name);
  }
};