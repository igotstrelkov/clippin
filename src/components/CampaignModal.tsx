import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { SignInForm } from "../SignInForm";

interface CampaignModalProps {
  campaignId: Id<"campaigns">;
  onClose: () => void;
}

export function CampaignModal({ campaignId, onClose }: CampaignModalProps) {
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const campaign = useQuery(api.campaigns.getCampaign, { campaignId });
  const profile = useQuery(api.profiles.getCurrentProfile);
  const submitToCampaign = useMutation(api.submissions.submitToCampaign);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = tiktokUrl.trim();
    if (!url) return;

    // Validate TikTok URL format
    const tiktokPatterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
      /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
    ];

    const isValidUrl = tiktokPatterns.some((pattern) => pattern.test(url));
    if (!isValidUrl) {
      toast.error("Please provide a valid TikTok URL");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitToCampaign({
        campaignId,
        tiktokUrl: url,
      });
      toast.success("Submission successful! Awaiting brand approval.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!campaign) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  const canSubmit = profile?.userType === "creator" && profile?.tiktokVerified;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">{campaign.title}</h2>
            <div className="flex items-center gap-3">
              {campaign.brandLogo ? (
                <img
                  src={campaign.brandLogo}
                  alt={`${campaign.brandName} logo`}
                  className="w-8 h-8 rounded-full object-cover bg-gray-700"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={`w-8 h-8 bg-purple-600 rounded flex items-center justify-center ${campaign.brandLogo ? "hidden" : ""}`}
              >
                <span className="text-white font-bold text-sm">
                  {campaign.brandName.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-gray-300 font-bold">{campaign.brandName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Campaign Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-400 mb-1">
                ${(campaign.cpmRate / 100).toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">per 1,000 views</div>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                ${(campaign.maxPayoutPerSubmission / 100).toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">
                max payout per submission
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-gray-300">{campaign.description}</p>
          </div>

          {/* Source Content - Removed for now */}

          {/* Requirements */}
          {campaign.requirements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Requirements</h3>
              <ul className="space-y-2">
                {campaign.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">•</span>
                    <span className="text-gray-300">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Budget Progress */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Campaign Progress</h3>
            <div className="bg-gray-900 p-4 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>Budget Used</span>
                <span>
                  {(
                    ((campaign.totalBudget - campaign.remainingBudget) /
                      campaign.totalBudget) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>
                  $
                  {(
                    (campaign.totalBudget - campaign.remainingBudget) /
                    100
                  ).toLocaleString()}{" "}
                  spent
                </span>
                <span>
                  ${(campaign.remainingBudget / 100).toLocaleString()} remaining
                </span>
              </div>
            </div>
          </div>

          {/* Submission Form */}
          {profile ? (
            canSubmit ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    TikTok Post URL
                  </label>
                  <input
                    type="url"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@username/video/..."
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !tiktokUrl.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isSubmitting ? "Submitting..." : "Submit to Campaign"}
                </button>
              </form>
            ) : (
              <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-400 mb-2">
                  Action Required
                </h4>
                {profile.userType !== "creator" ? (
                  <p className="text-yellow-300">
                    Only creators can submit to campaigns. Please update your
                    profile.
                  </p>
                ) : (
                  <p className="text-yellow-300">
                    Please verify your TikTok account to submit to campaigns.
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4 text-center">
              <h4 className="font-semibold text-blue-400 mb-2">
                Sign In Required
              </h4>
              <p className="text-blue-300 mb-4">
                Please sign in to submit to this campaign.
              </p>
              <div className="max-w-sm mx-auto">
                <SignInForm />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
