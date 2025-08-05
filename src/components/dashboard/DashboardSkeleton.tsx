import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { memo } from "react";

interface DashboardSkeletonProps {
  isLoading: boolean;
  hasError: boolean;
}

export const DashboardSkeleton = memo(({ isLoading, hasError }: DashboardSkeletonProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>
          Could not load dashboard data. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
});

DashboardSkeleton.displayName = "DashboardSkeleton";
