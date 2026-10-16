import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (see Dockerfile)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    // Server function calls are logged with their arguments. After a failed save these
    // include what was typed in the form (names, phones, note text), and the log is
    // less protected than the database.
    serverFunctions: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
