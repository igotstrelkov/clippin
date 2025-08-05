import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { memo } from "react";
import { LoadingSpinner } from "../ui/loading-spinner";

interface DashboardSkeletonProps {
  isLoading: boolean;
  hasError: boolean;
}

export const DashboardSkeleton = memo(
  ({ isLoading, hasError }: DashboardSkeletonProps) => {
    if (isLoading) {
      return <LoadingSpinner />;
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
  }
);

DashboardSkeleton.displayName = "DashboardSkeleton";
