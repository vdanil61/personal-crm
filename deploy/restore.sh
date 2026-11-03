#!/usr/bin/env bash
# Restores the production database from a backup file. Only a human runs this; CI never does.
# The database is replaced as a whole: drop it, create it empty, load the backup.
# First it shows what gets replaced, waits for "yes" and saves a copy of the current database.
# The app keeps its version: the same image is stopped and started again, migrations are not run.
#
#   ssh -t crm sudo -u deploy /home/deploy/personal-crm/restore.sh BACKUP
#     BACKUP  a file name from backups/ or a path to it; without it, the list of backups is shown
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

snapshot=""
trap 'printf "\nRESTORE FAILED at step: %s\n" "$current_step"
  [ -z "$snapshot" ] || printf "The database as it was before this restore: %s\nTo bring it back: %s/restore.sh %s\n" "$snapshot" "$PWD" "$snapshot"' ERR

list_backups() {
  local names
  names="$(backup_names)"
  if [ -z "$names" ]; then
    echo "No backups in $PWD/backups"
    return
  fi
  echo "Backups in $PWD/backups, newest first (UTC time _ app version it was taken on):"
  while read -r name; do
    printf '  %s  %s\n' "$name" "$(du -h "backups/$name" | cut -f1)"
  done <<<"$names"
}

if [ $# -eq 0 ]; then
  echo "usage: restore.sh BACKUP   (in a terminal: ssh -t ...)"
  echo
  list_backups
  exit 1
fi
backup="$1"
if [ ! -f "$backup" ] && [ -f "backups/$1" ]; then
  backup="backups/$1"
fi
[ -f "$backup" ] || { echo "No backup file $1"; echo; list_backups; exit 1; }
[ -t 0 ] || { echo "Run it in a terminal (ssh -t ...): it asks you to type yes"; exit 1; }

take_lock

APP_IMAGE="$(cat current-image 2>/dev/null || true)"
[ -n "$APP_IMAGE" ] || { echo "Nothing is deployed yet: no current-image"; exit 1; }
export APP_IMAGE

step "Start database"
"${compose[@]}" up --detach --wait db

step "Check backup file"
if ! "${compose[@]}" exec -T db pg_restore --list <"$backup" >/dev/null; then
  echo "$backup is not a database backup"
  false
fi
db_name="$("${compose[@]}" exec -T db printenv POSTGRES_DB)"
db_size="$("${compose[@]}" exec -T db sh -c \
  'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align \
    --command "select pg_size_pretty(pg_database_size(current_database()))"')"
# File names are <date>_<time>_<version>[_before-restore].dump
backup_version="$(basename "$backup" .dump | cut -d_ -f3)"
app_version="$(short_version "$APP_IMAGE")"

cat <<EOF

Backup to load:      $backup ($(du -h "$backup" | cut -f1)), taken on app version $backup_version
Database to replace: $db_name in compose project prod, $db_size now
App version:         $APP_IMAGE, stays the same
A copy of the current database is saved to backups/ first.
EOF
if [ "$backup_version" != "$app_version" ]; then
  cat <<EOF

WARNING: the backup was taken on app version $backup_version, the app now runs $app_version.
Their tables may differ, and restore does not run migrations, so the app may break.
Usually you first roll the app back to $backup_version (rollback.sh), then restore.
EOF
fi
echo
read -r -p 'Type "yes" to replace the database: ' answer
[ "$answer" = "yes" ] || { echo "Cancelled, nothing changed"; exit 1; }

step "Save a copy of the current database"
backup_database before-restore
snapshot="$backup_file"

step "Stop app"
"${compose[@]}" stop app

step "Drop and create database $db_name"
"${compose[@]}" exec -T db sh -c \
  'dropdb --username "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb --username "$POSTGRES_USER" "$POSTGRES_DB"'

# One transaction: if loading fails, the database stays empty rather than half loaded
step "Load $backup"
if ! "${compose[@]}" exec -T db sh -c \
  'pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-owner --exit-on-error --single-transaction' \
  <"$backup"; then
  echo "The database $db_name is empty now and the app is stopped."
  false
fi

step "Start app $APP_IMAGE"
start_app

step "Smoke check: GET /health"
smoke_check

step "Restored $backup"
echo "app version:                   $APP_IMAGE"
echo "copy of the replaced database: $snapshot"
