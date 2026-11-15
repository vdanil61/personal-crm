// Production accepts only full SHAs with a successful staging job in GitHub history.
import { appendFileSync } from "node:fs";
import { api } from "./github-api.mjs";

async function main() {
  if (process.env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Run Deploy prod from the main branch");
  }
  if (process.env.ROLLBACK === "true") {
    appendFileSync(process.env.GITHUB_ENV, "ROLLBACK=true\n");
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      "Rollback requested: the server selects its previous production image. SHA input is ignored.\n",
    );
    return;
  }

  const requested = (process.env.REQUESTED_SHA || "").trim().toLowerCase();
  if (requested && !/^[0-9a-f]{40}$/.test(requested)) {
    throw new Error("Enter a full 40-character commit SHA, or leave SHA empty");
  }
  const repo = process.env.GITHUB_REPOSITORY;
  let selected;
  // Inspect completed staging jobs, including the old workflow which also deployed prod.
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      branch: "main",
      event: "push",
      status: "completed",
      per_page: "100",
      page: String(page),
      ...(requested ? { head_sha: requested } : {}),
    });
    const { workflow_runs: runs } = await api(`/repos/${repo}/actions/workflows/deploy.yml/runs?${query}`);
    for (const run of runs) {
      for (let jobPage = 1; ; jobPage++) {
        const { jobs } = await api(
          `/repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${jobPage}`,
        );
        for (const job of jobs) {
          if (job.name === "Deploy staging" && job.conclusion === "success") {
            if (!selected || job.completed_at > selected.completed_at) {
              selected = { ...job, sha: run.head_sha, url: run.html_url };
            }
          }
        }
        if (jobs.length < 100) break;
      }
    }
    if (runs.length < 100) break;
  }
  if (!selected) {
    throw new Error("No successful staging deployment found for the requested release");
  }
  const image = `ghcr.io/${repo.toLowerCase()}:${selected.sha}`;
  appendFileSync(process.env.GITHUB_ENV, `IMAGE=${image}\nROLLBACK=false\n`);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `Selected SHA: \`${selected.sha}\`\n\n[Successful staging deployment](${selected.url})\n`,
  );
  console.log(`Selected ${image}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
