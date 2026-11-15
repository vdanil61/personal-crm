#!/usr/bin/env bash
# One-time installation of this app's systemd timer. Run as root after copying deploy/.
# Never reads .env or changes other services, sites or timers.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)"; exit 1; }
cd "$(dirname "$0")"
app_dir=/home/deploy/personal-crm
[ -x "$app_dir/backup.sh" ] || { echo "Deploy the backup scripts to production first"; exit 1; }

install -m 644 systemd/personal-crm-backup.service /etc/systemd/system/personal-crm-backup.service
install -m 644 systemd/personal-crm-backup.timer /etc/systemd/system/personal-crm-backup.timer
systemctl daemon-reload
systemctl enable --now personal-crm-backup.timer
systemctl list-timers personal-crm-backup.timer --no-pager
