#!/usr/bin/env bash
# Run as root after the repository has been cloned and npm run setup completed
# as jevv. Does not edit the Hestia Nginx configuration.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root'; exit 1; }
app_dir=/home/jevv/web/trader.hs.vc/public_html
[[ -f "$app_dir/.env" && -f "$app_dir/src/server.ts" ]] || { echo 'Clone code and run setup as jevv first'; exit 1; }
node_major=$(/usr/bin/node -p 'process.versions.node.split(".")[0]')
[[ "$node_major" -ge 24 ]] || { echo 'Node 24+ required at /usr/bin/node'; exit 1; }
install -d -m 700 -o jevv -g jevv "$app_dir/data"
chown jevv:jevv "$app_dir/.env"
chmod 600 "$app_dir/.env"
runuser -u jevv -- bash -c 'cd /home/jevv/web/trader.hs.vc/public_html && npm test'
install -m 644 "$app_dir/deploy/agent-trader.service" /etc/systemd/system/agent-trader.service
systemctl daemon-reload
systemctl enable --now agent-trader.service
systemctl --no-pager --full status agent-trader.service
curl --fail --silent --show-error http://127.0.0.1:9010/api/health
