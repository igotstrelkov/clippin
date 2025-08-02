import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TikTokVerification } from "./TikTokVerification";
import { StripeConnectOnboarding } from "./StripeConnectOnboarding";
import { PayoutRequestModal } from "./PayoutRequestModal";
import { ViewTracker } from "./ViewTracker";
import { ViewChart } from "./ViewChart";
import { useState } from "react";
import { toast } from "sonner";

export function CreatorDashboard() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  
  const stats = useQuery(api.profiles.getCreatorStats);
  const submissions = useQuery(api.submissions.getCreatorSubmissions);
  const pendingEarnings = useQuery(api.payoutHelpers.getPendingEarnings);
  const payouts = useQuery(api.payoutHelpers.getCreatorPayouts);
  const getConnectStatus = useAction(api.payouts.getConnectAccountStatus);

  if (stats === undefined || submissions === undefined || pendingEarnings === undefined || payouts === undefined) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Unable to load creator stats</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Creator Dashboard</h1>
        {!stats.tiktokVerified && (
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg px-4 py-2">
            <span className="text-yellow-400 text-sm">⚠️ Verify TikTok to submit</span>
          </div>
        )}
      </div>

      {/* TikTok Verification */}
      {!stats.tiktokVerified && <TikTokVerification />}

      {/* Stripe Connect Onboarding */}
      <StripeConnectOnboarding />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-green-400 mb-1">
            ${(stats.totalEarnings / 100).toFixed(2)}
          </div>
          <div className="text-gray-400">Total Earnings</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            ${(pendingEarnings.totalPending / 100).toFixed(2)}
          </div>
          <div className="text-gray-400">Pending Payout</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {stats.totalSubmissions}
          </div>
          <div className="text-gray-400">Total Submissions</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-400 mb-1">
            {stats.recent24hViews.toLocaleString()}
          </div>
          <div className="text-gray-400">Views (24h)</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            ${(stats.recent24hEarnings / 100).toFixed(2)}
          </div>
          <div className="text-gray-400">Earnings (24h)</div>
        </div>
      </div>

      {/* Payout Section */}
      {pendingEarnings.totalPending > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold mb-1">Available for Payout</h3>
              <p className="text-gray-400">
                {pendingEarnings.submissions.length} approved submission{pendingEarnings.submissions.length !== 1 ? 's' : ''} ready
              </p>
            </div>
            <button 
              onClick={() => setShowPayoutModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Request ${(pendingEarnings.totalPending / 100).toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {/* Payout History */}
      {payouts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Payouts</h3>
          <div className="space-y-3">
            {payouts.slice(0, 3).map((payout) => (
              <div key={payout._id} className="flex justify-between items-center p-3 bg-gray-900 rounded-lg">
                <div>
                  <div className="font-medium">${(payout.amount / 100).toFixed(2)}</div>
                  <div className="text-sm text-gray-400">
                    {new Date(payout.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs ${
                  payout.status === "completed" 
                    ? "bg-green-900/20 text-green-400"
                    : payout.status === "failed"
                    ? "bg-red-900/20 text-red-400"
                    : "bg-yellow-900/20 text-yellow-400"
                }`}>
                  {payout.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Submissions with View Tracking */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Submissions</h3>
        {submissions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">No Submissions Yet</h4>
            <p className="text-gray-400">Browse campaigns and submit your TikTok videos to start earning!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.slice(0, 5).map((submission) => (
              <div key={submission._id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium">{submission.campaignTitle}</h4>
                    <p className="text-sm text-gray-400">
                      Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                    </p>
                    {submission.status === "rejected" && submission.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded text-sm">
                        <span className="text-red-400 font-medium">Feedback: </span>
                        <span className="text-red-300">{submission.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`inline-block px-2 py-1 rounded-full text-xs ${
                      submission.status === "approved" 
                        ? "bg-green-900/20 text-green-400"
                        : submission.status === "rejected"
                        ? "bg-red-900/20 text-red-400"
                        : "bg-yellow-900/20 text-yellow-400"
                    }`}>
                      {submission.status}
                    </div>
                    <button
                      onClick={() => setExpandedSubmission(
                        expandedSubmission === submission._id ? null : submission._id
                      )}
                      className="text-purple-400 hover:text-purple-300 text-sm"
                    >
                      {expandedSubmission === submission._id ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                {/* View Tracking */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <ViewTracker 
                    submissionId={submission._id} 
                    showRefreshButton={true}
                  />
                  {submission.status === "approved" && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-400 mb-1">
                        ${((submission.earnings || 0) / 100).toFixed(2)}
                      </div>
                      <div className="text-gray-400">Earnings</div>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedSubmission === submission._id && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <ViewChart submissionId={submission._id} />
                    <div className="mt-4">
                      <a 
                        href={submission.tiktokUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 underline text-sm"
                      >
                        View TikTok Post →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      <PayoutRequestModal 
        isOpen={showPayoutModal} 
        onClose={() => setShowPayoutModal(false)} 
      />
    </div>
  );
}
