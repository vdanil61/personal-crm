#!/usr/bin/env bash
# Deploys one app image on the server: migrations -> new app version -> smoke check of /health.
# Runs as user "deploy" in /home/deploy/personal-crm; CI copies the deploy/ files there.
#
#   deploy.sh IMAGE [REGISTRY_USER]
#     IMAGE          e.g. ghcr.io/vdanil61/personal-crm:<commit sha>
#     REGISTRY_USER  log in to ghcr.io first, reading the token from stdin (CI does this)
#
# No automatic rollback: on any failure the script stops with a non-zero exit code.
# If migrations fail, the new version is not started and the old one keeps running.
set -euo pipefail
cd "$(dirname "$0")"

image="${1:?usage: deploy.sh IMAGE [REGISTRY_USER]}"
registry_user="${2:-}"
compose=(docker compose -p prod -f compose.yaml)
current_step="start"

step() {
  current_step="$1"
  printf '\n==> %s\n' "$1"
}
trap 'printf "\nDEPLOY FAILED at step: %s\n" "$current_step"' ERR

# One deploy at a time, even if someone starts one by hand while CI is deploying
exec 9>.deploy.lock
flock --nonblock 9 || { echo "Another deploy is running"; exit 1; }

[ -f .env ] || { echo "No .env in $PWD: create it from .env.example"; exit 1; }
chmod 600 .env

step "Pull image $image"
if [ -n "$registry_user" ]; then
  # The token comes on stdin, so it never shows up in the process list or logs
  docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null' EXIT
fi
docker image inspect "$image" >/dev/null 2>&1 || docker pull --quiet "$image"
export APP_IMAGE="$image"

step "Start database"
"${compose[@]}" up --detach --wait db

step "Apply migrations"
"${compose[@]}" run --rm migrate

step "Start new app version"
if ! "${compose[@]}" up --detach --wait --wait-timeout 120 app; then
  "${compose[@]}" logs --tail 50 app
  false
fi

step "Smoke check: GET /health"
healthy=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/health; then
    echo
    healthy=1
    break
  fi
  sleep 3
done
if [ -z "$healthy" ]; then
  echo "SMOKE FAILED: /health did not answer 200"
  "${compose[@]}" logs --tail 50 app
  false
fi

step "Record release"
current="$(cat current-image 2>/dev/null || true)"
if [ -n "$current" ] && [ "$current" != "$image" ]; then
  echo "$current" > previous-image
fi
echo "$image" > current-image
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $image" >> releases.log
echo "current:  $image"
echo "previous: $(cat previous-image 2>/dev/null || echo none)"

step "Remove old app images, keep current and previous"
previous="$(cat previous-image 2>/dev/null || true)"
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
  if [ "$ref" != "$image" ] && [ "$ref" != "$previous" ]; then
    docker image rm "$ref" >/dev/null && echo "removed $ref" || echo "could not remove $ref"
  fi
done
docker image prune --force >/dev/null || true

step "Deployed $image"
