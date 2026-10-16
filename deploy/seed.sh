#!/usr/bin/env bash
# Fills an empty production database with test contacts and notes, using the current app image.
# The seed script leaves a database that already has contacts untouched.
# Called by .github/workflows/seed.yml.
#
#   seed.sh [COUNT]   (default: 1000)
set -euo pipefail
cd "$(dirname "$0")"

count="${1:-1000}"
[[ "$count" =~ ^[1-9][0-9]*$ ]] || { echo "COUNT must be a positive integer, got \"$count\""; exit 1; }

APP_IMAGE="$(cat current-image 2>/dev/null || true)"
[ -n "$APP_IMAGE" ] || { echo "Nothing is deployed yet"; exit 1; }
export APP_IMAGE

docker compose -p prod -f compose.yaml run --rm seed node scripts/seed.cjs "$count"
