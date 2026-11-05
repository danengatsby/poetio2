import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Resolve metadata before the HTML head is sent, including for browsers with
  // JavaScript disabled. These pages read metadata from the local content DB.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
