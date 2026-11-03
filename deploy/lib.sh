# Shared by deploy.sh and restore.sh: they cd into this folder and source it. Not run on its own.

compose=(docker compose -p prod -f compose.yaml)
backups_kept=10
current_step="start"

step() {
  current_step="$1"
  printf '\n==> %s\n' "$1"
}

# One deploy or restore at a time, even if someone starts one by hand while CI is deploying
take_lock() {
  exec 9>.deploy.lock
  flock --nonblock 9 || { echo "Another deploy or restore is running"; exit 1; }
}

# ghcr.io/vdanil61/personal-crm:<commit sha> -> the first 7 characters of the sha, as GitHub shows commits
short_version() {
  local tag="${1##*:}"
  printf '%s' "${tag:0:7}"
}

# Dumps the database to backups/<UTC time>_<version running now>[_SUFFIX].dump and puts the path in $backup_file.
# Needs the db service running and APP_IMAGE set (compose.yaml requires it).
backup_database() {
  local suffix="${1:+_$1}" running tmp
  running="$(cat current-image 2>/dev/null || true)"
  backup_file="backups/$(date -u +%Y-%m-%d_%H%M%S)_$(short_version "${running:-none}")$suffix.dump"
  tmp="$backup_file.partial"
  install -d -m 700 backups
  # pg_dump inside the db container connects over the local socket, so it needs no password.
  # The dump goes to a .partial file first, so a broken dump never looks like a finished backup.
  if ! (umask 077 && "${compose[@]}" exec -T db sh -c \
    'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format custom' >"$tmp"); then
    rm -f "$tmp"
    echo "BACKUP FAILED: could not dump the database"
    return 1
  fi
  mv "$tmp" "$backup_file"
  echo "saved $backup_file ($(du -h "$backup_file" | cut -f1))"
}

# Backup file names, newest first: a name starts with the time, so name order is time order
backup_names() {
  [ -d backups ] || return 0
  find backups -maxdepth 1 -name '*.dump' -printf '%f\n' | sort -r
}

prune_backups() {
  backup_names | tail -n +$((backups_kept + 1)) | while read -r name; do
    rm -f "backups/$name"
    echo "removed backups/$name"
  done
}

start_app() {
  if ! "${compose[@]}" up --detach --wait --wait-timeout 120 app; then
    "${compose[@]}" logs --tail 50 app
    return 1
  fi
}

smoke_check() {
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/health; then
      echo
      return 0
    fi
    sleep 3
  done
  echo "SMOKE FAILED: /health did not answer 200"
  "${compose[@]}" logs --tail 50 app
  return 1
}
