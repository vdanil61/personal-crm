import { loadEnvFile } from "../../src/db/url";
import { prepareTestDatabase } from "./prepare-db";

export default async function setup() {
  loadEnvFile();

  try {
    await prepareTestDatabase("test");
  } catch (error) {
    if ((error as { code?: string }).code === "ECONNREFUSED") {
      // Printed first: Vitest adds a misleading "No test files found" line after a failed global setup
      console.error(
        "\nCannot connect to the local database, so the tests cannot start.\n" +
          "Start it with `docker compose up -d --wait` and run `pnpm test` again.\n",
      );
      throw withoutStack("Cannot connect to the local database.");
    }
    throw error;
  }
}

// Vitest 5.0.5 fails with "code.charCodeAt is not a function" while printing the stack of an error
// thrown here and hides the message. An error without a stack is printed as plain text.
function withoutStack(message: string) {
  const error = new Error(message);
  error.stack = message;
  return error;
}
