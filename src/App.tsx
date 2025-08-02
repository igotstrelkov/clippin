import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { CampaignMarketplace } from "./components/CampaignMarketplace";
import { Dashboard } from "./components/Dashboard";
import { Navigation } from "./components/Navigation";
import { ProfileSetup } from "./components/ProfileSetup";

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Authenticated>
        {/* This is the main app for authenticated users */}
        <AuthenticatedApp />
      </Authenticated>
      <Unauthenticated>
        {/* This is the public-facing view for unauthenticated users */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto mt-20">
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <h1 className="text-2xl font-bold mb-6">Welcome to Clippin</h1>
              <p className="text-gray-300 mb-6">
                Sign in to access your dashboard and manage your campaigns or
                submissions.
              </p>
              <SignInForm />
            </div>
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}

function AuthenticatedApp() {
  const profile = useQuery(api.profiles.getCurrentProfile);
  const [currentView, setCurrentView] = useState<"marketplace" | "dashboard">(
    "marketplace"
  );

  if (profile === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  if (!profile) {
    // If authenticated but no profile, force profile setup
    return <ProfileSetup />;
  }

  // User is authenticated and has a profile, show the main app
  return (
    <>
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      <main className="container mx-auto px-4 py-8">
        {currentView === "marketplace" ? (
          <CampaignMarketplace />
        ) : (
          <Dashboard />
        )}
      </main>
    </>
  );
}

export default App;
