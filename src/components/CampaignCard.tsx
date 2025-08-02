import { Id } from "../../convex/_generated/dataModel";

interface Campaign {
  _id: Id<"campaigns">;
  title: string;
  description: string;
  category: string;
  cpmRate: number;
  maxPayoutPerSubmission: number;
  totalBudget: number;
  remainingBudget: number;
  brandName: string;
  brandLogo?: string | null;
}

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const budgetUsedPercentage =
    ((campaign.totalBudget - campaign.remainingBudget) / campaign.totalBudget) *
    100;

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer border border-gray-700 hover:border-purple-500"
    >
      {/* Header with brand info */}
      <div className="flex items-center gap-3 mb-4">
        {campaign.brandLogo ? (
          <img
            src={campaign.brandLogo}
            alt={`${campaign.brandName} logo`}
            className="w-10 h-10 rounded-full object-cover bg-gray-700"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={`w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center ${campaign.brandLogo ? "hidden" : ""}`}
        >
          <span className="text-white font-bold text-sm">
            {campaign.brandName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-gray-300 font-medium">{campaign.brandName}</p>
          <span className="inline-block px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded-full">
            {campaign.category}
          </span>
        </div>
      </div>

      {/* Campaign title and description */}
      <h3 className="text-xl font-bold mb-2 text-white">{campaign.title}</h3>
      <p className="text-gray-300 mb-4 line-clamp-2">{campaign.description}</p>

      {/* Payment info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900 p-3 rounded-lg">
          <div className="text-lg font-bold text-green-400">
            ${(campaign.cpmRate / 100).toFixed(2)}
          </div>
          <div className="text-xs text-gray-400">per 1,000 views</div>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg">
          <div className="text-lg font-bold text-blue-400">
            ${(campaign.maxPayoutPerSubmission / 100).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">max payout</div>
        </div>
      </div>

      {/* Budget progress */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Budget Used</span>
          <span className="text-gray-300">
            {budgetUsedPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
            style={{ width: `${Math.min(budgetUsedPercentage, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
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
  );
}
