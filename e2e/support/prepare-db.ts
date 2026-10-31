// Runs before the app under test is built and started (see playwright.config.ts):
// creates the database `<name>_e2e` if it is missing and applies the migrations,
// as the deploy applies them before a new version starts.
import { loadEnvFile } from "../../src/db/url";
import { prepareTestDatabase } from "../../tests/support/prepare-db";

loadEnvFile();

prepareTestDatabase("e2e").catch((error) => {
  if ((error as { code?: string }).code === "ECONNREFUSED") {
    console.error(
      "\nCannot connect to the local database, so the e2e tests cannot start.\n" +
        "Start it with `docker compose up -d --wait` and run `pnpm test:e2e` again.\n",
    );
  } else {
    console.error("Preparing the e2e database failed:", error);
  }
  process.exit(1);
});
