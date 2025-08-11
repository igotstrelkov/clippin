import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { 
      deps: { 
        inline: ["convex-test"] 
      } 
    },
    setupFiles: ["./test-setup.ts"],
    testTimeout: 30000, // 30 seconds for long-running API tests
  },
});