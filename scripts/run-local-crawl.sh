#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"
TARGET_URL="${1:-http://localhost:3000/api/cron/crawl}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.local が見つかりません: $ENV_FILE" >&2
  exit 1
fi

CRON_SECRET="$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | tail -n 1)"
if [ -z "${CRON_SECRET}" ]; then
  echo "ERROR: CRON_SECRET が .env.local に設定されていません" >&2
  exit 1
fi

echo "Running crawler: ${TARGET_URL}"
curl -sS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "$TARGET_URL"
echo
