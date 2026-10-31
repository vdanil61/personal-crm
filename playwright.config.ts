import { defineConfig, devices } from "@playwright/test";

import { loadEnvFile } from "./src/db/url";
import { getTestDatabaseUrl } from "./tests/support/test-db-url";

// End-to-end tests: a real browser clicks through the production build of the app,
// which works with a real database in Docker. The app runs on its own port and its own
// database `<name>_e2e`, so a running `pnpm dev` and the working contacts are never touched.
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

loadEnvFile();

export default defineConfig({
  testDir: "e2e",
  // All tests share one database, so they run one after another
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: BASE_URL,
    // What the page looked like at each step of a failed test: `pnpm exec playwright show-trace <file>`
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Migrations first, as on deploy; then the same build and the same server as in the Docker image:
    // the standalone server with the static files next to it (see Dockerfile)
    command: [
      "pnpm exec tsx e2e/support/prepare-db.ts",
      "pnpm build",
      "cp -R .next/static .next/standalone/.next/",
      "node .next/standalone/server.js",
    ].join(" && "),
    url: `${BASE_URL}/health`,
    // Something else on the port must not be mistaken for the app under test
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: getTestDatabaseUrl("e2e"), HOSTNAME: "127.0.0.1", PORT: String(PORT) },
  },
});
