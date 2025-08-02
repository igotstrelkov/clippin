import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { EditCampaignModal } from "./EditCampaignModal";
import { SubmissionsReviewModal } from "./SubmissionsReviewModal";
import { useState } from "react";
import { toast } from "sonner";

export function BrandDashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [reviewingCampaign, setReviewingCampaign] = useState<any>(null);

  const campaigns = useQuery(api.campaigns.getBrandCampaigns);
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign);

  if (campaigns === undefined) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      await deleteCampaign({ campaignId: campaignId as any });
      toast.success("Campaign deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete campaign");
    }
  };

  const activeCampaigns = campaigns.filter(c => c.status === "active");
  const draftCampaigns = campaigns.filter(c => c.status === "draft");
  const completedCampaigns = campaigns.filter(c => c.status === "completed");

  const totalSpent = campaigns.reduce((sum, campaign) => 
    sum + (campaign.totalBudget - campaign.remainingBudget), 0
  );

  const totalViews = campaigns.reduce((sum, campaign) => 
    sum + (campaign.totalViews || 0), 0
  );

  const totalSubmissions = campaigns.reduce((sum, campaign) => 
    sum + (campaign.totalSubmissions || 0), 0
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Brand Dashboard</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
        >
          Create Campaign
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-green-400 mb-1">
            ${(totalSpent / 100).toFixed(2)}
          </div>
          <div className="text-gray-400">Total Spent</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {totalViews.toLocaleString()}
          </div>
          <div className="text-gray-400">Total Views</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-400 mb-1">
            {activeCampaigns.length}
          </div>
          <div className="text-gray-400">Active Campaigns</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            {totalSubmissions}
          </div>
          <div className="text-gray-400">Total Submissions</div>
        </div>
      </div>

      {/* Draft Campaigns - Payment Required */}
      {draftCampaigns.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">Payment Required</h3>
          </div>
          <p className="text-gray-400 mb-4">
            Complete payment for these campaigns to activate them and make them available to creators.
          </p>
          <div className="space-y-3">
            {draftCampaigns.map((campaign) => (
              <div key={campaign._id} className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-white">{campaign.title}</h4>
                    <p className="text-sm text-yellow-300">
                      Budget: ${(campaign.totalBudget / 100).toFixed(2)} • Created {new Date(campaign._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingCampaign(campaign)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Complete Payment
                    </button>
                    <button
                      onClick={() => handleDeleteCampaign(campaign._id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Campaigns */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Active Campaigns</h3>
        {activeCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-white mb-2">No Active Campaigns</h4>
            <p className="text-gray-400">Create your first campaign to start working with creators!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCampaigns.map((campaign) => (
              <div key={campaign._id} className="bg-gray-900 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-semibold text-white">{campaign.title}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    campaign.status === "active" 
                      ? "bg-green-900/20 text-green-400"
                      : campaign.status === "paused"
                      ? "bg-yellow-900/20 text-yellow-400"
                      : "bg-gray-900/20 text-gray-400"
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Budget:</span>
                    <span className="text-white">${(campaign.totalBudget / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Remaining:</span>
                    <span className="text-white">${(campaign.remainingBudget / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Views:</span>
                    <span className="text-white">{(campaign.totalViews || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Submissions:</span>
                    <span className="text-white">{campaign.totalSubmissions || 0}</span>
                  </div>
                </div>

                <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ 
                      width: `${Math.max(0, Math.min(100, ((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) * 100))}%` 
                    }}
                  ></div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setReviewingCampaign(campaign)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                  >
                    Review ({campaign.totalSubmissions || 0})
                  </button>
                  <button
                    onClick={() => setEditingCampaign(campaign)}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Campaigns */}
      {completedCampaigns.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Completed Campaigns</h3>
          <div className="space-y-3">
            {completedCampaigns.slice(0, 5).map((campaign) => (
              <div key={campaign._id} className="flex justify-between items-center p-4 bg-gray-900 rounded-lg">
                <div>
                  <h4 className="font-medium text-white">{campaign.title}</h4>
                  <p className="text-sm text-gray-400">
                    {(campaign.totalViews || 0).toLocaleString()} views • 
                    ${((campaign.totalBudget - campaign.remainingBudget) / 100).toFixed(2)} spent
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-green-400 font-medium">Completed</div>
                  <div className="text-xs text-gray-400">
                    {campaign.approvedSubmissions || 0} submissions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          // Campaigns will refresh automatically due to live queries
        }}
      />

      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          isOpen={!!editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSuccess={() => {
            setEditingCampaign(null);
            // Campaigns will refresh automatically due to live queries
          }}
        />
      )}

      {reviewingCampaign && (
        <SubmissionsReviewModal
          campaignId={reviewingCampaign._id}
          onClose={() => setReviewingCampaign(null)}
        />
      )}
    </div>
  );
}
