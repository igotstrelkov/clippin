import { Toaster } from "@/components/ui/sonner";
import { Authenticated, Unauthenticated } from "convex/react";
import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { SignInForm } from "./components/auth/SignInForm";
import { Navigation } from "./components/Navigation";
import { ThemeProvider } from "./components/theme-provider";
import { LoadingSpinner } from "./components/ui/loading-spinner";

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
const RouteLoader = () => <LoadingSpinner />;

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
            <UnauthenticatedApp />
          </Unauthenticated>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function UnauthenticatedApp() {
  const navigate = useNavigate();

  const handleAuthSuccess = () => {
    void navigate("/dashboard");
  };

  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <SignInForm onSuccess={handleAuthSuccess} />
      <Toaster />
    </div>
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/marketplace" element={<CampaignMarketplace />} />
            <Route path="/campaign/:campaignId" element={<CampaignDetails />} />
          </Routes>
        </Suspense>
        <Toaster />
      </main>
    </>
  );
}

export default App;
