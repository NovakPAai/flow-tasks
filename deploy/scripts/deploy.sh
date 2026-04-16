#!/usr/bin/env bash
# FlowTask deploy script — runs on the server
# Usage: bash -s -- [git-sha] (piped via stdin from GitHub Actions)
set -euo pipefail

APP_DIR="/opt/flowtask"
WORK_DIR="/tmp/flowtask-deploy-$(date +%Y%m%d_%H%M%S)"
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

# Clone into /tmp — world-writable, no permission issues
echo "→ Cloning code..."
git clone https://github.com/NovakPAai/flow-tasks.git "$WORK_DIR"
cd "$WORK_DIR"
git reset --hard "${GIT_SHA}"

# Build backend
echo "→ Building backend..."
cd "$WORK_DIR/backend"
npm ci --prefer-offline

# .env lives in APP_DIR — symlink into work dir so dotenv/config finds it
[[ -f "$APP_DIR/backend/.env" ]] || { echo "ERROR: $APP_DIR/backend/.env missing. Create it first."; exit 1; }
ln -sf "$APP_DIR/backend/.env" "$WORK_DIR/backend/.env"

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
cd "$WORK_DIR/frontend"
npm ci --prefer-offline
npm run build
mkdir -p "$APP_DIR/frontend/dist"
rsync -a --delete dist/ "$APP_DIR/frontend/dist/"

# Swap the live backend code — atomic replace
echo "→ Swapping backend code..."
mkdir -p "$APP_DIR/backend"
rsync -a --delete \
  --exclude='.env' \
  --exclude='node_modules' \
  "$WORK_DIR/backend/dist/" "$APP_DIR/backend/dist/"
rsync -a --delete \
  --exclude='.env' \
  "$WORK_DIR/backend/node_modules/" "$APP_DIR/backend/node_modules/"
cp "$WORK_DIR/deploy/ecosystem.config.js" "$APP_DIR/ecosystem.config.js"

# Update ecosystem cwd to APP_DIR
sed -i "s|/opt/flowtask-repo/backend|$APP_DIR/backend|g" "$APP_DIR/ecosystem.config.js"

# Restart backend
echo "→ Restarting PM2..."
cd "$APP_DIR/backend"
if pm2 describe flowtask-api &>/dev/null; then
  pm2 reload "$APP_DIR/ecosystem.config.js" --env production
else
  pm2 start "$APP_DIR/ecosystem.config.js" --env production
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

# Cleanup
rm -rf "$WORK_DIR"

echo "=== Deploy complete ==="
