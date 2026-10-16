#!/usr/bin/env bash
# One-time server preparation for automatic deploys. Run as root; safe to run again.
#
#   setup-server.sh DEPLOY_PUBLIC_KEY_FILE NGINX_SITE_FILE
#
# - user "deploy" runs the app with Docker: no password, no sudo; CI logs in with its SSH key
# - /home/deploy/personal-crm is the app folder, with an empty .env (chmod 600) to fill in
# - nginx sends app.percrm.ru to the app on 127.0.0.1:3000; the old site config is kept as a backup
# Nothing else on the server (other users, sites, keys) is changed.
set -euo pipefail

key_file="${1:?usage: setup-server.sh DEPLOY_PUBLIC_KEY_FILE NGINX_SITE_FILE}"
site_file="${2:?usage: setup-server.sh DEPLOY_PUBLIC_KEY_FILE NGINX_SITE_FILE}"
app_dir=/home/deploy/personal-crm
site=/etc/nginx/sites-available/app.percrm.ru.conf

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)"; exit 1; }

echo "==> User deploy (member of docker, no password, no sudo)"
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod --append --groups docker deploy
id deploy

echo "==> SSH key for GitHub Actions"
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# restrict: no port, agent or X11 forwarding and no terminal; commands and file copy only
printf 'restrict %s\n' "$(cat "$key_file")" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
ssh-keygen -l -f /home/deploy/.ssh/authorized_keys

echo "==> App folder $app_dir"
install -d -m 750 -o deploy -g deploy "$app_dir"
if [ ! -e "$app_dir/.env" ]; then
  install -m 600 -o deploy -g deploy /dev/null "$app_dir/.env"
fi
ls -la "$app_dir"

echo "==> nginx: app.percrm.ru -> 127.0.0.1:3000"
if cmp -s "$site_file" "$site"; then
  echo "already up to date"
else
  backup="$site.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$site" "$backup"
  echo "previous config saved to $backup"
  install -m 644 "$site_file" "$site"
  if ! nginx -t; then
    echo "nginx config test failed, restoring the previous config"
    cp -a "$backup" "$site"
    exit 1
  fi
  systemctl reload nginx
  echo "nginx reloaded"
fi

echo "==> Done"
