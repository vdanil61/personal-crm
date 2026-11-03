// A setting from the environment (.env locally and on the server). A missing one stops with a clear message
// at the moment it is needed, not at start: `next build` runs without any of the login settings.
export function requiredSetting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: add it to .env (see .env.example)`);
  return value;
}
