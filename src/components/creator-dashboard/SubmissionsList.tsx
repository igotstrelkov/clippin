import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen } from "lucide-react";
import { memo } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { SubmissionCard } from "../SubmissionCard";

interface SubmissionsListProps {
  pendingSubmissions: any[];
  reviewedSubmissions: any[];
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
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>
          <p className="text-muted-foreground mb-6">
            Review and approve creator submissions
          </p>

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
                  <div className="text-center py-10 text-muted-foreground">
                    <FolderOpen className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">
                      No Pending Submissions
                    </h3>
                    <p className="mt-1 text-sm">
                      Your pending submissions will appear here.
                    </p>
                  </div>
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
                  <div className="text-center py-10 text-muted-foreground">
                    <FolderOpen className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-medium">
                      No Reviewed Submissions
                    </h3>
                    <p className="mt-1 text-sm">
                      Your reviewed submissions will appear here.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }
);

SubmissionsList.displayName = "SubmissionsList";
