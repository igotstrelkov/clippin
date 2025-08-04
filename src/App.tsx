import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { CampaignDetails } from "./components/CampaignDetails";
import { CampaignMarketplace } from "./components/CampaignMarketplace";
import { Dashboard } from "./components/Dashboard";
import { Navigation } from "./components/Navigation";
import { ProfileSetup } from "./components/ProfileSetup";
import { ThemeProvider } from "./components/theme-provider";

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <BrowserRouter>
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
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AuthenticatedApp() {
  const profile = useQuery(api.profiles.getCurrentProfile);

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
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/marketplace" replace />} />
          <Route path="/marketplace" element={<CampaignMarketplace />} />
          <Route path="/campaign/:campaignId" element={<CampaignDetails />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
