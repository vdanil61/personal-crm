// Database errors carry the failed query with its values (names, phones, note text, emails),
// and the log is less protected than the database. So only the class and code of each
// error in the cause chain are logged, e.g. "DrizzleQueryError > DatabaseError 42P01".
export function describeError(err: unknown): string {
  const parts: string[] = [];
  for (let current = err; current instanceof Error && parts.length < 5; current = current.cause) {
    const code = "code" in current && typeof current.code === "string" ? ` ${current.code}` : "";
    parts.push(`${current.constructor.name}${code}`);
  }
  return parts.join(" > ") || "unknown error";
}
