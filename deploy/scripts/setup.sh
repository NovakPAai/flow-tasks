#!/usr/bin/env bash
# One-time server setup for FlowTask
# Run as root on first deploy
set -euo pipefail

APP_DIR="/opt/flowtask"
LOG_DIR="/var/log/flowtask"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"

echo "=== FlowTask Server Setup ==="

# Node.js 20
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# PM2
npm install -g pm2

# Create dirs
mkdir -p "$APP_DIR"/{backend,frontend/dist}
mkdir -p "$LOG_DIR"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR" "$LOG_DIR"

# nginx site
cp /tmp/flowtask.conf /etc/nginx/sites-available/flowtask
ln -sf /etc/nginx/sites-available/flowtask /etc/nginx/sites-enabled/flowtask
nginx -t && systemctl reload nginx

# PM2 startup
pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER"

echo "=== Setup complete. Now copy .env to $APP_DIR/backend/.env ==="
