// Enhanced error handling utilities for better resilience

import { toast } from "sonner";

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = "Network connection failed") {
    super(message, "NETWORK_ERROR", 0, true);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, "VALIDATION_ERROR", 400, false);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, "AUTH_ERROR", 401, false);
    this.name = 'AuthenticationError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string, public paymentCode?: string) {
    super(message, "PAYMENT_ERROR", 402, false);
    this.name = 'PaymentError';
  }
}

/**
 * Enhanced error handler with automatic retry logic and user-friendly messages
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    retryDelay?: number;
    showError?: boolean;
    errorMessage?: string;
    onError?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    retryDelay = 1000,
    showError = true,
    errorMessage,
    onError,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Call error callback if provided
      onError?.(lastError, attempt);

      // Check if error is retryable
      const isRetryable = 
        lastError instanceof AppError ? lastError.retryable :
        lastError instanceof TypeError || // Network errors often appear as TypeError
        lastError.message.includes('fetch') ||
        lastError.message.includes('network') ||
        lastError.message.includes('timeout');

      // If not retryable or last attempt, break
      if (!isRetryable || attempt === retries) {
        break;
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
      );
    }
  }

  // Show user-friendly error message
  if (showError) {
    const message = errorMessage || getUserFriendlyError(lastError!);
    toast.error(message);
  }

  throw lastError!;
}

/**
 * Convert technical errors to user-friendly messages
 */
export function getUserFriendlyError(error: Error): string {
  if (error instanceof ValidationError) {
    return error.message;
  }
  
  if (error instanceof AuthenticationError) {
    return "Please sign in to continue";
  }
  
  if (error instanceof PaymentError) {
    return `Payment failed: ${error.message}`;
  }
  
  if (error instanceof NetworkError) {
    return "Connection problem. Please check your internet and try again.";
  }

  // Handle common error patterns
  if (error.message.includes('fetch')) {
    return "Connection problem. Please try again.";
  }
  
  if (error.message.includes('timeout')) {
    return "Request timed out. Please try again.";
  }
  
  if (error.message.includes('Not authenticated')) {
    return "Please sign in to continue";
  }

  // Fallback to original message but sanitized
  return error.message || "Something went wrong. Please try again.";
}

/**
 * Wrapper for mutation operations with enhanced error handling
 */
export function withErrorHandling<T extends any[], R>(
  mutationFn: (...args: T) => Promise<R>,
  errorMessage?: string
) {
  return async (...args: T): Promise<R> => {
    return handleAsyncOperation(
      () => mutationFn(...args),
      { errorMessage }
    );
  };
}