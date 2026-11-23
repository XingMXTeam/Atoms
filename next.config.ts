import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { previewAssetHeaderRules } from "./src/lib/preview/cache-headers";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return previewAssetHeaderRules();
  },
};

export default nextConfig;
