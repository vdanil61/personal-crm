// Shared GitHub REST client for the Actions runner. Never prints credentials.
export async function api(path, method = "GET") {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}
