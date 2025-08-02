import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { CampaignPayment } from "./CampaignPayment";

interface EditCampaignModalProps {
  campaign: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCampaignModal({ campaign, isOpen, onClose, onSuccess }: EditCampaignModalProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "lifestyle",
    endDate: "",
    youtubeAssetUrl: "",
    requirements: [""],
    status: "active" as "active" | "paused" | "completed",
  });

  const updateCampaign = useMutation(api.campaigns.updateCampaign);

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title || "",
        description: campaign.description || "",
        category: campaign.category || "lifestyle",
        endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : "",
        youtubeAssetUrl: campaign.youtubeAssetUrl || "",
        requirements: campaign.requirements?.length > 0 ? campaign.requirements : [""],
        status: campaign.status || "active",
      });
    }
  }, [campaign]);

  if (!isOpen || !campaign) return null;

  // If this is a draft campaign, show payment flow
  if (campaign.status === "draft") {
    if (showPayment) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Complete Payment</h2>
                <p className="text-gray-400 text-sm">Activate "{campaign.title}"</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <CampaignPayment
              campaignId={campaign._id}
              amount={campaign.totalBudget / 100}
              onSuccess={() => {
                toast.success("Campaign activated successfully!");
                onSuccess();
                onClose();
              }}
              onCancel={() => setShowPayment(false)}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Activate Campaign</h2>
              <p className="text-gray-400 text-sm">"{campaign.title}"</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-yellow-400 font-medium">Payment Required</span>
              </div>
              <p className="text-yellow-300 text-sm">
                This campaign is in draft status. Complete payment to activate it and make it available to creators.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-white mb-3">Campaign Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Budget:</span>
                  <span className="text-white">${(campaign.totalBudget / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CPM Rate:</span>
                  <span className="text-white">${(campaign.cpmRate / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Payout:</span>
                  <span className="text-white">${(campaign.maxPayoutPerSubmission / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Category:</span>
                  <span className="text-white capitalize">{campaign.category}</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowPayment(true)}
                className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRequirementChange = (index: number, value: string) => {
    const newRequirements = [...formData.requirements];
    newRequirements[index] = value;
    setFormData({ ...formData, requirements: newRequirements });
  };

  const addRequirement = () => {
    setFormData({
      ...formData,
      requirements: [...formData.requirements, ""],
    });
  };

  const removeRequirement = (index: number) => {
    if (formData.requirements.length > 1) {
      const newRequirements = formData.requirements.filter((_, i) => i !== index);
      setFormData({ ...formData, requirements: newRequirements });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.requirements.some(req => !req.trim())) {
      toast.error("Please fill in all requirements or remove empty ones");
      return;
    }

    setLoading(true);
    try {
      await updateCampaign({
        campaignId: campaign._id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        endDate: formData.endDate ? new Date(formData.endDate).getTime() : undefined,
        youtubeAssetUrl: formData.youtubeAssetUrl,
        requirements: formData.requirements.filter(req => req.trim()),
        status: formData.status,
      });

      toast.success("Campaign updated successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Edit Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Campaign Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="Enter campaign title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="Describe your campaign"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="lifestyle">Lifestyle</option>
                <option value="fashion">Fashion</option>
                <option value="beauty">Beauty</option>
                <option value="fitness">Fitness</option>
                <option value="food">Food</option>
                <option value="travel">Travel</option>
                <option value="tech">Technology</option>
                <option value="gaming">Gaming</option>
                <option value="music">Music</option>
                <option value="comedy">Comedy</option>
                <option value="education">Education</option>
                <option value="business">Business</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              YouTube Asset URL (Optional)
            </label>
            <input
              type="url"
              value={formData.youtubeAssetUrl}
              onChange={(e) => setFormData({ ...formData, youtubeAssetUrl: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Requirements
            </label>
            <div className="space-y-2">
              {formData.requirements.map((requirement, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={requirement}
                    onChange={(e) => handleRequirementChange(index, e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    placeholder={`Requirement ${index + 1}`}
                  />
                  {formData.requirements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRequirement(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRequirement}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                + Add Requirement
              </button>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Update Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
