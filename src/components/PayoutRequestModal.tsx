import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface PayoutRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PayoutRequestModal({ isOpen, onClose }: PayoutRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);

  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
  const processPayout = useAction(api.payouts.processPayout);
  const user = useQuery(api.auth.loggedInUser);

  if (!isOpen) return null;

  const handleSubmissionToggle = (submissionId: string) => {
    setSelectedSubmissions(prev => 
      prev.includes(submissionId)
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const selectedEarnings = pendingEarnings?.submissions
    .filter(sub => selectedSubmissions.includes(sub._id))
    .reduce((sum, sub) => sum + (sub.earnings || 0), 0) || 0;

  const handleRequestPayout = async () => {
    if (!user || selectedSubmissions.length === 0) return;

    setLoading(true);
    try {
      await processPayout({
        creatorId: user._id,
        amount: selectedEarnings,
        submissionIds: selectedSubmissions as any[],
      });
      
      toast.success("Payout processed successfully!");
      onClose();
      setSelectedSubmissions([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process payout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Request Payout</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!pendingEarnings || pendingEarnings.submissions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Pending Earnings</h3>
            <p className="text-gray-400">You don't have any approved submissions to cash out yet.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Total Available</span>
                  <span className="text-2xl font-bold text-green-400">
                    ${(pendingEarnings.totalPending / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Selected Amount</span>
                  <span className="text-xl font-bold text-purple-400">
                    ${(selectedEarnings / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="text-lg font-medium text-white">Select Submissions</h3>
              {pendingEarnings.submissions.map((submission) => (
                <div
                  key={submission._id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedSubmissions.includes(submission._id)
                      ? 'border-purple-500 bg-purple-500 bg-opacity-10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  onClick={() => handleSubmissionToggle(submission._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.includes(submission._id)}
                        onChange={() => handleSubmissionToggle(submission._id)}
                        className="mr-3 w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                      />
                      <div>
                        <h4 className="font-medium text-white">{submission.campaignTitle}</h4>
                        <p className="text-sm text-gray-400">
                          {submission.viewCount?.toLocaleString() || 0} views
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        ${((submission.earnings || 0) / 100).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(submission.approvedAt || submission._creationTime).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPayout}
                disabled={loading || selectedSubmissions.length === 0}
                className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : `Request $${(selectedEarnings / 100).toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
