#!/usr/bin/env bash
# Deploys one app image on the server:
# database backup -> migrations -> new app version -> smoke check of /health.
# Runs as user "deploy" in /home/deploy/personal-crm; CI copies the whole deploy/ folder there.
#
#   deploy.sh prod|staging IMAGE [REGISTRY_USER]
#   deploy.sh IMAGE [REGISTRY_USER]  (legacy production invocation)
#     IMAGE          e.g. ghcr.io/vdanil61/personal-crm:<commit sha>
#     REGISTRY_USER  log in to ghcr.io first, reading the token from stdin (CI does this)
#
# No automatic rollback: on any failure the script stops with a non-zero exit code.
# If the backup or migrations fail, the new version is not started and the old one keeps running.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

environment=prod
if [ "${1:-}" = prod ] || [ "${1:-}" = staging ]; then
  environment="$1"
  shift
fi
configure_environment "$environment"
image="${1:?usage: deploy.sh [prod|staging] IMAGE [REGISTRY_USER]}"
registry_user="${2:-}"
trap 'printf "\nDEPLOY FAILED at step: %s\n" "$current_step"' ERR

take_lock

[ -f .env ] || { echo "No .env in $PWD: create it from .env.example"; exit 1; }
chmod 600 .env
if [ "$environment" = staging ] && [ ! -f .staging-initialized ]; then
  echo "Initialize staging first: run restore.sh staging BACKUP in a human terminal."
  exit 1
fi

step "Pull image $image"
if [ -n "$registry_user" ]; then
  # Separate registry credentials for concurrent prod and staging pulls.
  registry_config="$(mktemp -d)"
  trap 'rm -rf "$registry_config"' EXIT
  docker --config "$registry_config" login ghcr.io --username "$registry_user" --password-stdin >/dev/null
  docker --config "$registry_config" pull --quiet "$image"
else
  docker image inspect "$image" >/dev/null 2>&1 || docker pull --quiet "$image"
fi
export APP_IMAGE="$image"

step "Start database"
"${compose[@]}" up --detach --wait db

# Named after the version running before this deploy: the backup holds that version's tables
if [ "$environment" = prod ]; then
  step "Back up database"
  backup_database
fi

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

if [ "$environment" = prod ]; then
  step "Remove old app images, protect production and staging releases"
  (
    # Staging may be pulling or migrating an image not recorded as current yet.
    # Hold its lock through cleanup, or skip cleanup while it is busy.
    staging_dir=/home/deploy/personal-crm-staging
    if [ -d "$staging_dir" ]; then
      exec 8>"$staging_dir/.deploy.lock"
      flock --nonblock 8 || { echo "Staging is busy; skipping image cleanup"; exit 0; }
    fi
    staging_image="$(cat "$staging_dir/current-image" 2>/dev/null || true)"
    staging_previous="$(cat "$staging_dir/previous-image" 2>/dev/null || true)"
    previous="$(cat previous-image 2>/dev/null || true)"
    cutoff="$(date --date='14 days ago' +%s)"
    docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
      if [ "$ref" = "$image" ] || [ "$ref" = "$previous" ] || [ "$ref" = "$staging_image" ] || [ "$ref" = "$staging_previous" ]; then
        continue
      fi
      created="$(docker image inspect --format '{{.Created}}' "$ref")"
      if [ "$(date --date="$created" +%s)" -lt "$cutoff" ]; then
        docker image rm "$ref" >/dev/null && echo "removed $ref" || echo "could not remove $ref"
      fi
    done
  )

  step "Remove old backups, keep the last $backups_kept"
  prune_backups
fi

step "Deployed $image"
