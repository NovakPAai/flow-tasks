#!/usr/bin/env bash
# FlowTask rollback — restores last DB backup + previous PM2 snapshot
set -euo pipefail

BACKUP_DIR="/opt/flowtask-backups"
APP_DIR="/opt/flowtask"

echo "=== FlowTask Rollback ==="

# Find latest backup
LATEST=$(ls -t "$BACKUP_DIR"/db_*.sql 2>/dev/null | head -1)
if [[ -z "$LATEST" ]]; then
  echo "No database backup found in $BACKUP_DIR"
  exit 1
fi
echo "→ Restoring $LATEST..."

DB_URL="${DATABASE_URL:-$(grep DATABASE_URL "$APP_DIR/backend/.env" | cut -d= -f2-)}"
psql "$DB_URL" < "$LATEST"
echo "✓ Database restored"

# Restart PM2
pm2 reload flowtask-api
echo "✓ PM2 reloaded"

# Health check
for i in $(seq 1 6); do
  if curl -sf http://localhost:3101/api/health &>/dev/null; then
    echo "✓ Healthy after rollback"
    exit 0
  fi
  sleep 5
done
echo "✗ Still unhealthy after rollback — check logs: pm2 logs flowtask-api"
exit 1
