import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fromRoot("./src/") },
      // `server-only` throws outside the Next.js server; in tests it is an empty module
      { find: "server-only", replacement: fromRoot("./tests/support/empty-module.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Creates the test database and applies migrations once, before all tests
    globalSetup: ["./tests/support/global-setup.ts"],
    // Runs before every test file: points the app at the test database
    setupFiles: ["./tests/support/setup.ts"],
    // All tests share one database, so test files run one after another
    fileParallelism: false,
  },
});
