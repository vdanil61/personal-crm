#!/usr/bin/env bash
# Runs on the Actions runner. Copies every deploy script, then calls the server entry point.
set -euo pipefail

environment="${1:?usage: run-deploy.sh prod|staging}"
case "$environment" in
  prod) app_dir=personal-crm ;;
  staging) app_dir=personal-crm-staging ;;
  *) echo "Environment must be prod or staging"; exit 1 ;;
esac

if [ "${ROLLBACK:-false}" = true ]; then
  [ "$environment" = prod ] || { echo "Workflow rollback is production only"; exit 1; }
else
  [[ "${IMAGE:-}" =~ ^ghcr\.io/[a-z0-9._/-]+:[0-9a-f]{40}$ ]] || { echo "A full commit SHA image is required"; exit 1; }
fi

# Keep server directory permissions and never replace its .env.
tar -C deploy --exclude=.env -cf - . |
  ssh server "cd $app_dir && flock --nonblock .deploy.lock tar --no-overwrite-dir -xf -"

if [ "${ROLLBACK:-false}" = true ]; then
  ssh server "$app_dir/deploy.sh prod --rollback"
else
  printf '%s\n%s\n%s' "$IMAGE" "$REGISTRY_USER" "$REGISTRY_TOKEN" |
    ssh server "IFS= read -r image && IFS= read -r registry_user && exec $app_dir/deploy.sh $environment \"\$image\" \"\$registry_user\""
fi

actual_image="$(ssh server "cat $app_dir/current-image")"
[[ "$actual_image" =~ :[0-9a-f]{40}$ ]] || { echo "Server returned an invalid release image"; exit 1; }
{
  echo "### Deployed $environment"
  echo "SHA: \`${actual_image##*:}\`"
  echo "Image: \`$actual_image\`"
  echo "Smoke /health: passed"
} >> "$GITHUB_STEP_SUMMARY"
