import { useState, useEffect } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface ConnectStatus {
  hasAccount: boolean;
  isComplete: boolean;
  requiresAction?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

export function StripeConnectOnboarding() {
  const [loading, setLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  
  const createConnectAccount = useAction(api.payouts.createStripeConnectAccount);
  const createOnboardingLink = useAction(api.payouts.createConnectOnboardingLink);
  const getAccountStatus = useAction(api.payouts.getConnectAccountStatus);
  const user = useQuery(api.auth.loggedInUser);

  useEffect(() => {
    checkAccountStatus();
  }, []);

  const checkAccountStatus = async () => {
    try {
      const status = await getAccountStatus();
      setConnectStatus(status);
    } catch (error) {
      console.error("Failed to check account status:", error);
    }
  };

  const handleCreateAccount = async () => {
    if (!user?.email) {
      toast.error("Email is required to create a payment account");
      return;
    }

    setLoading(true);
    try {
      await createConnectAccount({ email: user.email });
      toast.success("Payment account created! Now let's complete the setup.");
      await checkAccountStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    setLoading(true);
    try {
      const result = await createOnboardingLink();
      window.location.href = result.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start onboarding");
      setLoading(false);
    }
  };

  if (connectStatus === null) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!connectStatus.hasAccount) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Set Up Payments</h3>
            <p className="text-gray-400">Create your payment account to receive payouts</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">What you'll need:</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Government-issued ID</li>
              <li>• Bank account information</li>
              <li>• Tax information (SSN or EIN)</li>
              <li>• Business details (if applicable)</li>
            </ul>
          </div>
          
          <button
            onClick={handleCreateAccount}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Create Payment Account"}
          </button>
        </div>
      </div>
    );
  }

  if (!connectStatus.isComplete) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Complete Setup</h3>
            <p className="text-gray-400">Finish setting up your payment account</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Account Status</span>
              <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">Incomplete</span>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${connectStatus.chargesEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                Charges {connectStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${connectStatus.payoutsEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                Payouts {connectStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          <button
            onClick={handleStartOnboarding}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Complete Setup"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mr-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Payment Account Ready</h3>
          <p className="text-gray-400">You can now receive payouts</p>
        </div>
      </div>

      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">Account Status</span>
          <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">Active</span>
        </div>
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full mr-2 bg-green-500"></div>
            Charges Enabled
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full mr-2 bg-green-500"></div>
            Payouts Enabled
          </div>
        </div>
      </div>

      <button
        onClick={checkAccountStatus}
        className="w-full mt-4 bg-gray-700 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-600 transition-colors"
      >
        Refresh Status
      </button>
    </div>
  );
}
