#!/usr/bin/env bash
# Deploys one app image on the server:
# database backup -> migrations -> new app version -> smoke check of /health.
# Runs as user "deploy" in /home/deploy/personal-crm; CI copies the whole deploy/ folder there.
#
#   deploy.sh IMAGE [REGISTRY_USER]
#     IMAGE          e.g. ghcr.io/vdanil61/personal-crm:<commit sha>
#     REGISTRY_USER  log in to ghcr.io first, reading the token from stdin (CI does this)
#
# No automatic rollback: on any failure the script stops with a non-zero exit code.
# If the backup or migrations fail, the new version is not started and the old one keeps running.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

image="${1:?usage: deploy.sh IMAGE [REGISTRY_USER]}"
registry_user="${2:-}"
trap 'printf "\nDEPLOY FAILED at step: %s\n" "$current_step"' ERR

take_lock

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

# Named after the version running before this deploy: the backup holds that version's tables
step "Back up database"
backup_database

step "Apply migrations"
"${compose[@]}" run --rm migrate

step "Start new app version"
start_app

step "Smoke check: GET /health"
smoke_check

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

step "Remove old backups, keep the last $backups_kept"
prune_backups

step "Deployed $image"
