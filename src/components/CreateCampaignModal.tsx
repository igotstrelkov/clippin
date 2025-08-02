import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { CampaignPayment } from "./CampaignPayment";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CampaignFormData {
  title: string;
  description: string;
  category: string;
  totalBudget: number;
  cpmRate: number;
  maxPayoutPerSubmission: number;
  endDate: string;
  youtubeAssetUrl: string;
  requirements: string[];
}

export function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [loading, setLoading] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>({
    title: "",
    description: "",
    category: "lifestyle",
    totalBudget: 500,
    cpmRate: 5,
    maxPayoutPerSubmission: 100,
    endDate: "",
    youtubeAssetUrl: "",
    requirements: [""],
  });

  const createDraftCampaign = useMutation(api.campaigns.createDraftCampaign);

  if (!isOpen) return null;

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.requirements.some(req => !req.trim())) {
      toast.error("Please fill in all requirements or remove empty ones");
      return;
    }

    if (formData.totalBudget < 50) {
      toast.error("Minimum campaign budget is $50");
      return;
    }

    if (formData.cpmRate < 1) {
      toast.error("Minimum CPM rate is $1.00");
      return;
    }

    if (formData.maxPayoutPerSubmission > formData.totalBudget) {
      toast.error("Max payout per submission cannot exceed total budget");
      return;
    }

    if (formData.youtubeAssetUrl && !formData.youtubeAssetUrl.includes('youtube.com')) {
      toast.error("Please provide a valid YouTube URL");
      return;
    }

    setLoading(true);
    try {
      const campaignId = await createDraftCampaign({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        totalBudget: Math.round(formData.totalBudget * 100), // Convert to cents
        cpmRate: Math.round(formData.cpmRate * 100), // Convert to cents
        maxPayoutPerSubmission: Math.round(formData.maxPayoutPerSubmission * 100), // Convert to cents
        endDate: formData.endDate ? new Date(formData.endDate).getTime() : undefined,
        youtubeAssetUrl: formData.youtubeAssetUrl,
        requirements: formData.requirements.filter(req => req.trim()),
      });

      setDraftCampaignId(campaignId);
      setStep('payment');
      toast.success("Campaign details saved! Complete payment to launch your campaign.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success("Campaign created and funded successfully!");
    onSuccess();
    handleClose();
  };

  const handleClose = () => {
    setStep('form');
    setDraftCampaignId(null);
    setFormData({
      title: "",
      description: "",
      category: "lifestyle",
      totalBudget: 500,
      cpmRate: 5,
      maxPayoutPerSubmission: 100,
      endDate: "",
      youtubeAssetUrl: "",
      requirements: [""],
    });
    onClose();
  };

  const handleBackToForm = () => {
    setStep('form');
  };

  if (step === 'payment' && draftCampaignId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Complete Payment</h2>
              <p className="text-gray-400 text-sm">Step 2 of 2: Fund your campaign</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-400 font-medium">Payment Required</span>
              </div>
              <p className="text-blue-300 text-sm">
                Complete payment to activate your campaign and make it available to creators.
              </p>
            </div>
          </div>

          <CampaignPayment
            campaignId={draftCampaignId}
            amount={formData.totalBudget}
            onSuccess={handlePaymentSuccess}
            onCancel={handleBackToForm}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Create Campaign</h2>
            <p className="text-gray-400 text-sm">Step 1 of 2: Campaign details</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-6">
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
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Total Budget ($)
              </label>
              <input
                type="number"
                min="50"
                max="10000"
                step="50"
                value={formData.totalBudget}
                onChange={(e) => setFormData({ ...formData, totalBudget: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                CPM Rate ($)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                step="0.5"
                value={formData.cpmRate}
                onChange={(e) => setFormData({ ...formData, cpmRate: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Max Payout ($)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={formData.maxPayoutPerSubmission}
                onChange={(e) => setFormData({ ...formData, maxPayoutPerSubmission: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
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

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">Budget Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Campaign Budget:</span>
                <span className="text-white">${formData.totalBudget.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Processing Fee (2.9% + $0.30):</span>
                <span className="text-white">${(formData.totalBudget * 0.029 + 0.30).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 flex justify-between font-medium">
                <span className="text-white">Total Charge:</span>
                <span className="text-white">${(formData.totalBudget + formData.totalBudget * 0.029 + 0.30).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Continue to Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
