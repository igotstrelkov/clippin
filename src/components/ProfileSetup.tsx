import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

export function ProfileSetup() {
  const [userType, setUserType] = useState<"creator" | "brand" | null>(null);
  const [creatorName, setCreatorName] = useState("");
  // const [tiktokUsername, setTiktokUsername] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateProfile = useMutation(api.profiles.updateProfile);
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo must be smaller than 5MB");
        return;
      }

      setSelectedLogo(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | undefined> => {
    if (!selectedLogo) return undefined;

    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedLogo.type },
        body: selectedLogo,
      });

      if (!result.ok) {
        throw new Error("Failed to upload logo");
      }

      const { storageId } = await result.json();
      return storageId;
    } catch (error) {
      console.error("Logo upload error:", error);
      throw new Error("Failed to upload logo");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) return;

    setLoading(true);
    try {
      let logoStorageId: string | undefined;

      // Upload logo if selected (for brands)
      if (userType === "brand" && selectedLogo) {
        logoStorageId = await uploadLogo();
      }

      if (userType === "creator") {
        await updateProfile({
          userType: "creator",
          creatorName,
          // tiktokUsername: tiktokUsername.replace("@", ""),
        });
      } else {
        await updateProfile({
          userType: "brand",
          companyName,
          companyLogo: logoStorageId,
        });
      }
      toast.success("Profile created successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create profile"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-800 rounded-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Welcome to Clippin!</h1>
          <p className="text-gray-300">
            Let's set up your profile to get started.
          </p>
        </div>

        {!userType ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center mb-6">
              Choose your account type:
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Creator Option */}
              <button
                onClick={() => setUserType("creator")}
                className="p-6 border-2 border-gray-600 rounded-lg hover:border-purple-500 hover:bg-gray-750 transition-all group"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Creator</h3>
                  <p className="text-gray-300 text-sm">
                    Create TikTok content for brand campaigns and earn money
                    based on your video performance.
                  </p>
                </div>
              </button>

              {/* Brand Option */}
              <button
                onClick={() => setUserType("brand")}
                className="p-6 border-2 border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-750 transition-all group"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Brand</h3>
                  <p className="text-gray-300 text-sm">
                    Launch marketing campaigns and connect with TikTok creators
                    to promote your products or services.
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">
                Complete your {userType} profile
              </h2>
            </div>

            {userType === "creator" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    placeholder="Your creator name"
                    required
                  />
                </div>

                {/* <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    TikTok Username *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                      @
                    </span>
                    <input
                      type="text"
                      value={tiktokUsername}
                      onChange={(e) => setTiktokUsername(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                      placeholder="your_tiktok_username"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    This will be used to verify your TikTok account
                  </p>
                </div> */}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Your company name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Logo
                  </label>
                  <div className="space-y-4">
                    {logoPreview && (
                      <div className="flex justify-center">
                        <div className="relative">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-24 h-24 object-cover rounded-lg border-2 border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLogo(null);
                              setLogoPreview(null);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-650 hover:border-blue-500 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg
                            className="w-8 h-8 mb-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <p className="mb-2 text-sm text-gray-400">
                            <span className="font-semibold">
                              Click to upload
                            </span>{" "}
                            or drag and drop
                          </p>
                          <p className="text-xs text-gray-400">
                            PNG, JPG, GIF up to 5MB
                          </p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleLogoSelect}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setUserType(null)}
                className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  userType === "creator"
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {loading ? "Creating Profile..." : "Complete Setup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
