import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { CampaignMarketplace } from "./components/CampaignMarketplace";
import { Dashboard } from "./components/Dashboard";
import { Navigation } from "./components/Navigation";
import { ProfileSetup } from "./components/ProfileSetup";
import { ThemeProvider } from "./components/theme-provider";
import { Loader2 } from "lucide-react";

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background text-foreground">
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
      <Unauthenticated>
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  </ThemeProvider>
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
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <ProfileSetup />;
  }

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
