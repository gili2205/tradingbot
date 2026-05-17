#!/usr/bin/env bash
# GCP VM setup script — run once as root after creating the VM.
# Usage: curl -sL <raw_url>/deploy/setup-vm.sh | sudo bash
set -euo pipefail

REPO_URL="https://github.com/andy-12-08/autonomous_trading_agent.git"
INSTALL_DIR="/opt/trading_bot"
BOT_USER="trading"
SERVICE_FILE="/etc/systemd/system/trading-bot.service"

echo "=== 1. System packages ==="
apt-get update -qq
apt-get install -y -qq python3 python3-pip git

echo "=== 2. Create bot user ==="
id "$BOT_USER" &>/dev/null || useradd -r -m -s /bin/bash "$BOT_USER"

echo "=== 3. Clone repo ==="
if [ -d "$INSTALL_DIR/.git" ]; then
    git -C "$INSTALL_DIR" pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
fi
chown -R "$BOT_USER:$BOT_USER" "$INSTALL_DIR"

echo "=== 4. Install Python deps ==="
su - "$BOT_USER" -c "python3 -m pip install --user -q -r $INSTALL_DIR/requirements.txt"

echo "=== 5. Create .env (fill in values after this script) ==="
ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" <<'EOF'
ALPACA_KEY=
ALPACA_SECRET=
ALPACA_ENDPOINT=https://paper-api.alpaca.markets/v2
ANTHROPIC_API_KEY=
FIREBASE_SERVICE_ACCOUNT=
EOF
    chown "$BOT_USER:$BOT_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo ">>> .env created at $ENV_FILE — fill in your credentials"
fi

echo "=== 6. Install systemd service ==="
cp "$INSTALL_DIR/deploy/bot.service" "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable trading-bot
echo ">>> Service installed. Start with: systemctl start trading-bot"

echo ""
echo "=== DONE ==="
echo "Next steps:"
echo "  1. Fill in $ENV_FILE (ALPACA_KEY, ALPACA_SECRET, ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT)"
echo "  2. systemctl start trading-bot"
echo "  3. journalctl -u trading-bot -f   (to watch logs)"
