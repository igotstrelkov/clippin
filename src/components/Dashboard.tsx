import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BrandDashboard } from "./BrandDashboard";
import { CreatorDashboard } from "./CreatorDashboard";
import { ProfileSetup } from "./ProfileSetup";
import { LoadingSpinner } from "./ui/loading-spinner";

export function Dashboard() {
  const profile = useQuery(api.profiles.getCurrentProfile);

  if (profile === undefined) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Welcome to Clippin!
          </h1>
          <p className="text-muted-foreground">
            Let's set up your profile to get started
          </p>
        </div> */}
        <ProfileSetup />
      </div>
    );
  }

  if (profile.userType === "creator") {
    return <CreatorDashboard />;
  }

  return <BrandDashboard />;
}
