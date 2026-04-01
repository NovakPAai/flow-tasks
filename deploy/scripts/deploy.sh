#!/usr/bin/env bash
# FlowTask deploy script — runs on the server
# Usage: ./deploy.sh [git-sha]
set -euo pipefail

APP_DIR="/opt/flowtask"
REPO_DIR="/opt/flowtask-repo"
LOG_DIR="/var/log/flowtask"
BACKUP_DIR="/opt/flowtask-backups"
GIT_SHA="${1:-HEAD}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== FlowTask Deploy $GIT_SHA at $TIMESTAMP ==="

# Backup DB before migrate
mkdir -p "$BACKUP_DIR" 2>/dev/null || true
if command -v pg_dump &>/dev/null; then
  DB_URL="${DATABASE_URL:-}"
  if [[ -n "$DB_URL" ]]; then
    echo "→ Backing up database..."
    pg_dump "$DB_URL" > "$BACKUP_DIR/db_$TIMESTAMP.sql" 2>/dev/null || echo "  (backup skipped — pg_dump failed)"
  fi
fi

# Pull latest code
echo "→ Pulling code..."
if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone https://github.com/NovakPAai/flow-tasks.git "$REPO_DIR"
fi
cd "$REPO_DIR"
git fetch origin
git checkout "$GIT_SHA" 2>/dev/null || git reset --hard "origin/main"

# Build backend
echo "→ Building backend..."
cd "$REPO_DIR/backend"
npm ci --prefer-offline

# .env lives in APP_DIR — symlink into repo so dotenv/config finds it
[[ -f "$APP_DIR/backend/.env" ]] || { echo "ERROR: $APP_DIR/backend/.env missing. Create it first."; exit 1; }
ln -sf "$APP_DIR/backend/.env" "$REPO_DIR/backend/.env"

# Generate Prisma client + build
DATABASE_URL=$(grep DATABASE_URL "$APP_DIR/backend/.env" | cut -d= -f2-)
export DATABASE_URL
npx prisma generate --schema=src/prisma/schema.prisma
npm run build

# Run migrations
echo "→ Running migrations..."
npx prisma migrate deploy --schema=src/prisma/schema.prisma

# Build frontend
echo "→ Building frontend..."
cd "$REPO_DIR/frontend"
npm ci --prefer-offline
npm run build
rsync -a --delete dist/ "$APP_DIR/frontend/dist/"

# Restart backend
echo "→ Restarting PM2..."
cd "$REPO_DIR/backend"
if pm2 describe flowtask-api &>/dev/null; then
  pm2 reload "$REPO_DIR/deploy/ecosystem.config.js" --env production
else
  pm2 start "$REPO_DIR/deploy/ecosystem.config.js" --env production
fi
pm2 save

# Health check (retry 12×5s = 60s)
echo "→ Health check..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:3101/api/health &>/dev/null; then
    echo "✓ Backend healthy"
    break
  fi
  [[ $i -eq 12 ]] && { echo "✗ Health check failed after 60s"; pm2 logs flowtask-api --lines 30; exit 1; }
  sleep 5
done

echo "=== Deploy complete ==="
