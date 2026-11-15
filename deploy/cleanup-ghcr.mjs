// Runs only after a successful production deploy, serialized with image publishing.
// Keeps ten SHA-tagged builds and the manifests belonging to retained image indexes.
import { appendFileSync } from "node:fs";
import { api } from "./github-api.mjs";

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const { owner } = await api(`/repos/${repo}`);
  const packageName = encodeURIComponent(repo.slice(repo.indexOf("/") + 1));
  const prefix = owner.type === "Organization" ? "orgs" : "users";
  const base = `/${prefix}/${owner.login}/packages/container/${packageName}/versions`;
  const versions = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${base}?per_page=100&page=${page}`);
    versions.push(...batch);
    if (batch.length < 100) break;
  }
  const tags = (version) => version.metadata.container.tags;
  const isSha = (tag) => /^[0-9a-f]{40}$/.test(tag);
  const builds = versions
    .filter((version) => tags(version).some(isSha))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (builds.length === 0) {
    throw new Error("No SHA-tagged builds found; refusing to clean an unknown package");
  }

  const retained = new Set(builds.slice(0, 10).map((version) => version.name));
  // Leave tags outside the commit-SHA convention alone.
  for (const version of versions) {
    if (tags(version).some((tag) => !isSha(tag))) retained.add(version.name);
  }

  const credentials = Buffer.from(`${process.env.GITHUB_ACTOR}:${process.env.GH_TOKEN}`).toString("base64");
  const imageRepo = repo.toLowerCase();
  const tokenQuery = new URLSearchParams({
    service: "ghcr.io",
    scope: `repository:${imageRepo}:pull`,
  });
  const tokenResponse = await fetch(`https://ghcr.io/token?${tokenQuery}`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!tokenResponse.ok) {
    throw new Error(`GHCR authentication: HTTP ${tokenResponse.status}`);
  }
  const { token } = await tokenResponse.json();
  const visited = new Set();
  async function protectManifest(digest) {
    if (visited.has(digest)) return;
    visited.add(digest);
    retained.add(digest);
    const response = await fetch(`https://ghcr.io/v2/${imageRepo}/manifests/${digest}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: [
          "application/vnd.oci.image.index.v1+json",
          "application/vnd.oci.image.manifest.v1+json",
          "application/vnd.docker.distribution.manifest.list.v2+json",
          "application/vnd.docker.distribution.manifest.v2+json",
        ].join(", "),
      },
    });
    if (!response.ok) {
      throw new Error(`Read retained GHCR manifest ${digest}: HTTP ${response.status}`);
    }
    const manifest = await response.json();
    for (const child of manifest.manifests || []) {
      await protectManifest(child.digest);
    }
  }
  // Resolve every retained index before deleting anything, including provenance manifests.
  for (const digest of [...retained]) await protectManifest(digest);

  let deleted = 0;
  for (const version of versions) {
    if (retained.has(version.name)) continue;
    await api(`${base}/${version.id}`, "DELETE");
    console.log(`Removed GHCR version ${version.id} (${version.name})`);
    deleted++;
  }
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `GHCR: kept ${Math.min(builds.length, 10)} builds and their dependent manifests; removed ${deleted} old versions.\n`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
