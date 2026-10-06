#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm test
sudo systemctl restart agent-trader.service
sudo systemctl --no-pager --full status agent-trader.service
