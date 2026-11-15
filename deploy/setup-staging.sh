#!/usr/bin/env bash
# One-time staging setup. A human runs this in a terminal for sudo and htpasswd prompts.
# Does not read, create or modify .env, production files, existing SSH keys or other sites.
#   sudo bash setup-staging.sh CERTBOT_EMAIL [BASIC_AUTH_USER]
set -euo pipefail
cd "$(dirname "$0")"

email="${1:?usage: setup-staging.sh CERTBOT_EMAIL [BASIC_AUTH_USER]}"
auth_user="${2:-staging}"
domain=test-app.percrm.ru
app_dir=/home/deploy/personal-crm-staging
site=/etc/nginx/sites-available/test-app.percrm.ru.conf
enabled=/etc/nginx/sites-enabled/test-app.percrm.ru.conf
auth_file=/etc/nginx/personal-crm-staging.htpasswd
webroot=/var/www/personal-crm-staging-acme

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)"; exit 1; }
[ -t 0 ] || { echo "Run in a human terminal for the staging password prompt"; exit 1; }
for tool in nginx certbot htpasswd docker; do
  command -v "$tool" >/dev/null || { echo "Missing $tool; install it before setup"; exit 1; }
done
renewal_timer=certbot.timer
if systemctl list-unit-files --no-legend snap.certbot.renew.timer | grep -q '^snap.certbot.renew.timer'; then
  renewal_timer=snap.certbot.renew.timer
fi
systemctl list-unit-files --no-legend "$renewal_timer" | grep -q "^$renewal_timer" || {
  echo "No certbot renewal timer found; configure certificate renewal before setup"; exit 1;
}
id deploy >/dev/null
docker info --format '{{range .Plugins.Log}}{{println .}}{{end}}' | grep -qx journald || {
  echo "Docker journald logging driver is required"; exit 1;
}
[[ "$auth_user" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "Invalid Basic Auth user"; exit 1; }
if [ -e "$site" ] && ! grep -q '^# Managed by personal-crm staging setup\.' "$site"; then
  echo "Refusing to replace an existing unmanaged nginx site: $site"; exit 1
fi
if [ -e "$enabled" ] || [ -L "$enabled" ]; then
  [ "$(readlink "$enabled")" = "$site" ] || { echo "Refusing to replace $enabled"; exit 1; }
fi

install -d -m 750 -o deploy -g deploy "$app_dir"
exec 9>"$app_dir/.deploy.lock"
chown deploy:deploy "$app_dir/.deploy.lock"
flock --nonblock 9 || { echo "Staging is busy; run setup after it finishes"; exit 1; }
# Copy only the tracked deployment payload, excluding all .env files and server state.
tar --exclude='.env' --exclude='.env.*' --exclude='backups' --exclude='*.lock' \
  --exclude='current-image' --exclude='previous-image' --exclude='releases.log' \
  -cf - -- *.sh compose.yaml nginx | tar -C "$app_dir" --no-overwrite-dir -xf -
install -o deploy -g deploy -m 644 .env.example "$app_dir/.env.example"
chown -R deploy:deploy "$app_dir/nginx"
chown deploy:deploy "$app_dir"/*.sh "$app_dir/compose.yaml"
chmod 755 "$app_dir"/*.sh
install -d -m 755 "$webroot"

if [ ! -f "$auth_file" ]; then
  echo "Choose the staging HTTP password (not the production login)."
  htpasswd -cB "$auth_file" "$auth_user"
fi
chown root:www-data "$auth_file"
chmod 640 "$auth_file"

# No proxy until the certificate exists: never expose staging without its password.
if [ ! -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
  bootstrap="$(mktemp)"
  cat >"$bootstrap" <<'EOF'
# Managed by personal-crm staging setup. Do not reuse this file for other sites.
server {
    listen 80;
    listen [::]:80;
    server_name test-app.percrm.ru;
    location /.well-known/acme-challenge/ {
        root /var/www/personal-crm-staging-acme;
    }
    location / { return 404; }
}
EOF
  install -m 644 "$bootstrap" "$site"
  rm -f "$bootstrap"
  ln -sfn "$site" "$enabled"
  nginx -t
  systemctl reload nginx
fi

certbot certonly --non-interactive --agree-tos --email "$email" \
  --webroot --webroot-path "$webroot" --cert-name "$domain" -d "$domain" --keep-until-expiring
install -m 644 nginx/test-app.percrm.ru.conf "$site"
ln -sfn "$site" "$enabled"
nginx -t
systemctl reload nginx

# A private hook for this certificate's renewal, without changing other sites or hooks.
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/personal-crm-staging <<'EOF'
#!/bin/sh
if [ "$RENEWED_LINEAGE" = /etc/letsencrypt/live/test-app.percrm.ru ]; then
  nginx -t && systemctl reload nginx
fi
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/personal-crm-staging
systemctl enable --now "$renewal_timer"

echo "Staging HTTPS/password configured. Next: create $app_dir/.env as deploy (mode 600), then run restore.sh staging BACKUP in your terminal. See README."
