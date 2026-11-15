#!/usr/bin/env bash
# Daily production backup. The systemd timer runs this as deploy at 03:00 Europe/Moscow.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
configure_environment prod
trap 'printf "\nBACKUP FAILED at step: %s\n" "$current_step"' ERR

# Wait for deploy/restore rather than silently losing the daily copy.
take_lock wait
export APP_IMAGE="$(cat current-image)"
[ -n "$APP_IMAGE" ] || { echo "No production image recorded"; exit 1; }

step "Daily production database backup"
backup_database daily
step "Keep the last $backups_kept backups in each category"
prune_backups
