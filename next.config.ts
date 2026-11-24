import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { securityHeaders } from "./src/lib/http/security-headers";
import {
  hashedStaticHeaderRules,
  previewAssetHeaderRules,
} from "./src/lib/preview/cache-headers";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      ...previewAssetHeaderRules(),
      ...hashedStaticHeaderRules(),
      {
        source: "/:path*",
        headers: securityHeaders({ hsts: false }),
      },
    ];
  },
};

export default nextConfig;
