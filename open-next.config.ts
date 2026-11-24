import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for Workers deploy. Incremental cache uses the dummy
// override until an R2 bucket is provisioned (see OpenNext caching docs).
export default defineCloudflareConfig({});
