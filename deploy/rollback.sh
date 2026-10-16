#!/usr/bin/env bash
# Manual rollback to the previous app version. Only a human runs this; CI never does.
# Database migrations are not undone: the previous version starts on the current schema.
#
#   sudo -u deploy /home/deploy/personal-crm/rollback.sh
set -euo pipefail
cd "$(dirname "$0")"

previous="$(cat previous-image 2>/dev/null || true)"
[ -n "$previous" ] || { echo "No previous version recorded, nothing to roll back to"; exit 1; }

echo "Rolling back to $previous"
exec ./deploy.sh "$previous"
