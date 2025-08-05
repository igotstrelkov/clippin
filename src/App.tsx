import { Toaster } from "@/components/ui/sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SignInForm } from "./SignInForm";
import { Navigation } from "./components/Navigation";
import { ThemeProvider } from "./components/theme-provider";

// Lazy load heavy components
const CampaignDetails = lazy(() =>
  import("./components/CampaignDetails").then((m) => ({
    default: m.CampaignDetails,
  }))
);
const CampaignMarketplace = lazy(() =>
  import("./components/CampaignMarketplace").then((m) => ({
    default: m.CampaignMarketplace,
  }))
);
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((m) => ({ default: m.Dashboard }))
);

// Loading component for suspense
const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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
  return (
    <>
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/marketplace" element={<CampaignMarketplace />} />
            <Route path="/campaign/:campaignId" element={<CampaignDetails />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </Suspense>
        <Toaster />
      </main>
    </>
  );
}

export default App;
