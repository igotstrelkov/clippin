import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  /** Size of the spinner icon */
  size?: "sm" | "md" | "lg";
  /** Additional className for the container */
  className?: string;
  /** Minimum height of the container */
  minHeight?: string;
  /** Whether to center the spinner in a flex container */
  centered?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingSpinner({
  size = "md",
  className,
  minHeight = "400px",
  centered = true,
}: LoadingSpinnerProps) {
  if (centered) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ minHeight }}
      >
        <Loader2 className={cn(sizeClasses[size], "animate-spin")} />
      </div>
    );
  }

  return (
    <Loader2 className={cn(sizeClasses[size], "animate-spin", className)} />
  );
}
