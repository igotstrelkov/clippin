import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

type VerificationStep = "username" | "generate" | "bio" | "verify" | "success";

export function TikTokVerification() {
  const [step, setStep] = useState<VerificationStep>("username");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const profile = useQuery(api.profiles.getCurrentProfile);
  const generateCode = useMutation(api.profiles.generateTikTokVerificationCode);
  const verifyBio = useMutation(api.profiles.verifyTikTokBio);

  // If already verified, show success state
  if (profile?.tiktokVerified) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-400 mb-2">TikTok Account Verified!</h3>
          <p className="text-gray-300 mb-2">@{profile.tiktokUsername}</p>
          <p className="text-sm text-gray-400">
            Your TikTok account has been successfully verified. You can now submit to campaigns.
          </p>
        </div>
      </div>
    );
  }

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const username = tiktokUsername.trim();
    if (!username) return;
    
    // Basic validation
    if (username.length < 2) {
      toast.error("Username must be at least 2 characters long");
      return;
    }
    
    if (username.length > 24) {
      toast.error("Username must be 24 characters or less");
      return;
    }
    
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      toast.error("Username can only contain letters, numbers, periods, and underscores");
      return;
    }
    
    setTiktokUsername(username);
    setStep("generate");
  };

  const handleGenerateCode = async () => {
    setIsLoading(true);
    try {
      const result = await generateCode({ tiktokUsername: tiktokUsername.trim() });
      setVerificationCode(result.verificationCode);
      setStep("bio");
      toast.success("Verification code generated!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBio = async () => {
    setIsLoading(true);
    try {
      await verifyBio({ tiktokUsername: tiktokUsername.trim() });
      setStep("success");
      toast.success("TikTok account verified successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const resetProcess = () => {
    setStep("username");
    setTiktokUsername("");
    setVerificationCode("");
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Verify Your TikTok Account</h3>
        
        {/* Progress indicator */}
        <div className="flex items-center space-x-2 mb-4">
          {["username", "generate", "bio", "verify"].map((stepName, index) => (
            <div key={stepName} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === stepName ? "bg-purple-600 text-white" :
                ["username", "generate", "bio", "verify"].indexOf(step) > index ? "bg-green-500 text-white" :
                "bg-gray-600 text-gray-300"
              }`}>
                {["username", "generate", "bio", "verify"].indexOf(step) > index ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {index < 3 && (
                <div className={`w-8 h-0.5 ${
                  ["username", "generate", "bio", "verify"].indexOf(step) > index ? "bg-green-500" : "bg-gray-600"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Username Input */}
      {step === "username" && (
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              TikTok Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                value={tiktokUsername}
                onChange={(e) => setTiktokUsername(e.target.value)}
                placeholder="yourusername"
                className="w-full pl-8 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-white"
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Enter your TikTok username without the @ symbol
            </p>
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Continue
          </button>
        </form>
      )}

      {/* Step 2: Generate Code */}
      {step === "generate" && (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-blue-400 font-medium">Ready to verify @{tiktokUsername}</span>
            </div>
            <p className="text-blue-300 text-sm">
              We'll generate a unique verification code that you'll need to add to your TikTok bio temporarily.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setStep("username")}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleGenerateCode}
              disabled={isLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {isLoading ? "Generating..." : "Generate Code"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Add to Bio */}
      {step === "bio" && (
        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-400 mb-3">Add this code to your TikTok bio:</h4>
            
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono text-green-400 tracking-wider">
                  {verificationCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(verificationCode);
                    toast.success("Code copied to clipboard!");
                  }}
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>
            </div>

            <div className="space-y-2 text-yellow-300 text-sm">
              <p className="font-medium">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open TikTok and go to your profile</li>
                <li>Tap "Edit profile"</li>
                <li>Add the code above anywhere in your bio</li>
                <li>Save your changes</li>
                <li>Come back here and click "Verify"</li>
              </ol>
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-400">
              <strong>Note:</strong> You can remove this code from your bio immediately after verification is complete. 
              The code expires in 1 hour for security.
            </p>
          </div>
          
          <div className="mb-3 text-center">
            <a
              href={`https://www.tiktok.com/@${tiktokUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-sm underline"
            >
              Open @{tiktokUsername} on TikTok →
            </a>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={resetProcess}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={() => setStep("verify")}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              I've Added the Code
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Verify */}
      {step === "verify" && (
        <div className="space-y-4">
          <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-purple-400 font-medium">Ready to verify</span>
            </div>
            <p className="text-purple-300 text-sm mb-3">
              We'll now check your TikTok bio for the verification code: <code className="bg-gray-800 px-2 py-1 rounded text-green-400">{verificationCode}</code>
            </p>
            <p className="text-xs text-gray-400">
              Make sure the code is visible in your bio and try again if verification fails.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setStep("bio")}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleVerifyBio}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                "Verify My Account"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Success */}
      {step === "success" && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div>
            <h4 className="text-xl font-semibold text-green-400 mb-2">Verification Complete!</h4>
            <p className="text-gray-300 mb-4">
              Your TikTok account <strong>@{tiktokUsername}</strong> has been successfully verified.
            </p>
          </div>

          <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
            <p className="text-green-300 text-sm">
              ✅ You can now remove the verification code from your TikTok bio<br/>
              ✅ You're eligible to submit to campaigns<br/>
              ✅ Start earning based on your content performance
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
