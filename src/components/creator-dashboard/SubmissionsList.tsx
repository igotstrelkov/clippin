import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { memo } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { SubmissionCard } from "../SubmissionCard";
import type { UISubmission } from "@/types/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { EmptyState } from "../ui/empty-state";

interface SubmissionsListProps {
  pendingSubmissions: UISubmission[];
  reviewedSubmissions: UISubmission[];
  isLoading: boolean;
  onApprove: (submissionId: Id<"submissions">) => void;
  onReject: (submissionId: Id<"submissions">, rejectionReason: string) => void;
  userType?: "creator" | "brand";
}

export const SubmissionsList = memo(
  ({
    pendingSubmissions,
    reviewedSubmissions,
    isLoading,
    onApprove,
    onReject,
    userType,
  }: SubmissionsListProps) => {
    if (isLoading) {
      return <LoadingSpinner />;
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Recent Submissions</CardTitle>
                <CardDescription>
                  Review and approve creator submissions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">
                  Pending ({pendingSubmissions.length})
                </TabsTrigger>
                <TabsTrigger value="reviewed">
                  Reviewed ({reviewedSubmissions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <div className="space-y-4 mt-4">
                  {pendingSubmissions.map((submission) => (
                    <SubmissionCard
                      key={submission._id}
                      submission={submission}
                      onApprove={onApprove}
                      onReject={onReject}
                      userType={userType}
                    />
                  ))}
                  {pendingSubmissions.length === 0 && (
                    <EmptyState
                      title="No Pending Submissions"
                      description="Your pending submissions will appear here."
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reviewed">
                <div className="space-y-4 mt-4">
                  {reviewedSubmissions.map((submission) => (
                    <SubmissionCard
                      key={submission._id}
                      submission={submission}
                      onApprove={onApprove}
                      onReject={onReject}
                      userType={userType}
                    />
                  ))}
                  {reviewedSubmissions.length === 0 && (
                    <EmptyState
                      title="No Reviewed Submissions"
                      description="Your reviewed submissions will appear here."
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }
);

SubmissionsList.displayName = "SubmissionsList";
