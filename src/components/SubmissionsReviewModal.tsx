import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { ViewTracker } from "./ViewTracker";
import { ViewChart } from "./ViewChart";

interface SubmissionsReviewModalProps {
  campaignId: string;
  onClose: () => void;
}

export function SubmissionsReviewModal({ campaignId, onClose }: SubmissionsReviewModalProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showViewDetails, setShowViewDetails] = useState<string | null>(null);
  
  const submissions = useQuery(api.submissions.getCampaignSubmissions, { 
    campaignId: campaignId as Id<"campaigns"> 
  });
  const updateSubmissionStatus = useMutation(api.submissions.updateSubmissionStatus);

  if (submissions === undefined) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  const handleApprove = async (submissionId: Id<"submissions">) => {
    try {
      await updateSubmissionStatus({ 
        submissionId, 
        status: "approved" 
      });
      toast.success("Submission approved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve submission");
    }
  };

  const handleRejectClick = (submission: any) => {
    setSelectedSubmission(submission);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedSubmission || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      await updateSubmissionStatus({ 
        submissionId: selectedSubmission._id, 
        status: "rejected",
        rejectionReason: rejectionReason.trim()
      });
      toast.success("Submission rejected with feedback sent to creator");
      setShowRejectModal(false);
      setSelectedSubmission(null);
      setRejectionReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject submission");
    }
  };

  const pendingSubmissions = submissions.filter(s => s.status === "pending");
  const reviewedSubmissions = submissions.filter(s => s.status !== "pending");

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Review Submissions</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="p-6">
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-gray-400 text-lg">No submissions yet</p>
                <p className="text-gray-500">Submissions will appear here once creators start submitting to your campaign.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Pending Submissions */}
                {pendingSubmissions.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-yellow-400">
                      Pending Review ({pendingSubmissions.length})
                    </h3>
                    <div className="grid gap-6">
                      {pendingSubmissions.map((submission) => (
                        <div key={submission._id} className="bg-gray-900 rounded-lg p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-lg font-semibold">{submission.creatorName}</h4>
                                {submission.tiktokUsername && (
                                  <span className="text-sm text-gray-400">@{submission.tiktokUsername}</span>
                                )}
                              </div>
                              
                              <div className="mb-4">
                                <a 
                                  href={submission.tiktokUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-purple-400 hover:text-purple-300 underline break-all"
                                >
                                  {submission.tiktokUrl}
                                </a>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div className="bg-gray-800 rounded-lg p-3">
                                  <ViewTracker 
                                    submissionId={submission._id} 
                                    showRefreshButton={true}
                                    compact={true}
                                  />
                                </div>
                                <div className="text-center">
                                  <div className={`text-lg font-bold ${
                                    submission.hasReachedThreshold ? "text-green-400" : "text-red-400"
                                  }`}>
                                    {submission.hasReachedThreshold ? "✓" : "✗"}
                                  </div>
                                  <div className="text-xs text-gray-400">1K+ Views</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-yellow-400">
                                    ${submission.potentialEarnings.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-400">Potential Earnings</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-gray-400">
                                    {new Date(submission.submittedAt).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-400">Submitted</div>
                                </div>
                              </div>

                              {/* View Details Toggle */}
                              <button
                                onClick={() => setShowViewDetails(
                                  showViewDetails === submission._id ? null : submission._id
                                )}
                                className="text-purple-400 hover:text-purple-300 text-sm mb-4"
                              >
                                {showViewDetails === submission._id ? "Hide" : "Show"} View History
                              </button>

                              {/* View Chart */}
                              {showViewDetails === submission._id && (
                                <div className="mb-4">
                                  <ViewChart submissionId={submission._id} height={100} />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApprove(submission._id)}
                              disabled={!submission.hasReachedThreshold}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectClick(submission)}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </div>

                          {!submission.hasReachedThreshold && (
                            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                              <p className="text-yellow-400 text-sm">
                                ⚠️ This submission hasn't reached the minimum 1,000 views threshold yet.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviewed Submissions */}
                {reviewedSubmissions.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-300">
                      Reviewed ({reviewedSubmissions.length})
                    </h3>
                    <div className="grid gap-4">
                      {reviewedSubmissions.map((submission) => (
                        <div key={submission._id} className="bg-gray-900 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-semibold">{submission.creatorName}</h4>
                                <div className={`px-2 py-1 rounded-full text-xs ${
                                  submission.status === "approved" 
                                    ? "bg-green-900/20 text-green-400"
                                    : "bg-red-900/20 text-red-400"
                                }`}>
                                  {submission.status}
                                </div>
                              </div>
                              <a 
                                href={submission.tiktokUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 underline text-sm break-all"
                              >
                                {submission.tiktokUrl}
                              </a>
                              {submission.status === "rejected" && submission.rejectionReason && (
                                <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded text-sm">
                                  <span className="text-red-400 font-medium">Reason: </span>
                                  <span className="text-red-300">{submission.rejectionReason}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <ViewTracker 
                                submissionId={submission._id} 
                                compact={true}
                              />
                              {submission.status === "approved" && (
                                <div className="text-sm text-green-400 mt-1">
                                  ${((submission.earnings || 0) / 100).toFixed(2)} earned
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Reject Submission</h3>
            <p className="text-gray-400 mb-4">
              Please provide feedback to help <strong>{selectedSubmission.creatorName}</strong> improve their future submissions.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Rejection Reason *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                placeholder="e.g., Content doesn't align with brand guidelines, insufficient views, poor video quality..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedSubmission(null);
                  setRejectionReason("");
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Reject & Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
