// Structured logging utility for production environments
// Replaces console.log statements with proper logging

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  userId?: string;
  submissionId?: string;
  campaignId?: string;
  creatorId?: string;
  accountId?: string;
  paymentIntentId?: string;
  eventType?: string;
  eventId?: string;
  templateType?: string;
  contentUrl?: string;
  updatedCount?: number;
  errorCount?: number;
  totalProcessed?: number;
  deletedCount?: number;
  beforeTimestamp?: number;
  amount?: number;
  error?: Error;
  metadata?: Record<string, any>;
  // Smart monitoring fields
  newTier?: string;
  growthRate?: number;
  tier?: string;
  processedCount?: number;
  apiCallsSaved?: number;
  totalChanges?: number;
  // Rate limiting fields
  waitTimeMs?: number;
  queueSize?: number;
  retryAfter?: string;
  timestamp?: number;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr}`.trim();
  }

  info(message: string, context?: LogContext) {
    const formatted = this.formatMessage("info", message, context);
    if (this.isDevelopment) {
      console.log(formatted);
    }
    // In production, this would send to a logging service like DataDog, LogRocket, etc.
    console.log(formatted);
  }

  warn(message: string, context?: LogContext) {
    const formatted = this.formatMessage("warn", message, context);
    if (this.isDevelopment) {
      console.warn(formatted);
    }
  }

  error(message: string, context?: LogContext) {
    const formatted = this.formatMessage("error", message, context);
    if (this.isDevelopment) {
      console.error(formatted);
    }
    // In production, this would send to error tracking service
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      const formatted = this.formatMessage("debug", message, context);
      console.debug(formatted);
    }
  }
}

export const logger = new Logger();
