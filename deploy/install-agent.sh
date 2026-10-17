#!/usr/bin/env bash
# Install (or remove) the minidash agent as a per-user launchd service on macOS.
#
#   deploy/install-agent.sh install   [--dry-run]
#   deploy/install-agent.sh uninstall [--dry-run]
#
# It runs as YOU, not root, so it can reach your Docker/Colima/Podman sockets.
# Re-running install is safe: the token in the env file is kept.
set -euo pipefail

CMD="${1:-}"; shift || true
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

LABEL=com.minidash.agent
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARE="$HOME/.local/share/minidash"
CONF="$HOME/.config/minidash"
LOGS="$HOME/Library/Logs/minidash"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

run() { if [ "$DRY" = 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }
say() { echo "minidash: $*"; }

install() {
  [ "$(uname)" = "Darwin" ] || { echo "macOS only" >&2; exit 1; }
  command -v macmon >/dev/null || say "warning: macmon not found; GPU and power cards will be unavailable (brew install macmon)"
  command -v go >/dev/null || [ -x "$ROOT/bin/minidash-agent" ] || { echo "need Go to build, or a prebuilt $ROOT/bin/minidash-agent" >&2; exit 1; }

  run mkdir -p "$SHARE" "$CONF" "$LOGS" "$(dirname "$PLIST")"
  if command -v go >/dev/null; then
    run bash -c "cd '$ROOT/agent' && go build -trimpath -o '$SHARE/minidash-agent' ./cmd/minidash-agent"
  else
    run install -m 755 "$ROOT/bin/minidash-agent" "$SHARE/minidash-agent"
  fi
  run install -m 755 "$ROOT/deploy/agent/run-agent.sh" "$SHARE/run-agent.sh"

  if [ -e "$CONF/agent.env" ]; then
    say "keeping existing $CONF/agent.env"
  elif [ "$DRY" = 1 ]; then
    echo "[dry-run] write $CONF/agent.env (mode 600) with a new random token"
  else
    umask 077
    cat > "$CONF/agent.env" <<ENV
# minidash agent settings. Keep this file private (mode 600).
MINIDASH_TOKEN=$(openssl rand -hex 24)
MINIDASH_ADDR=:8787
# Hosts allowed to open the WebSocket: the web UI container's address.
MINIDASH_ORIGINS=*:8080
# macmon sampling period in ms (lower = fresher GPU data, more CPU).
MINIDASH_SOC_INTERVAL_MS=2000
ENV
    say "created $CONF/agent.env"
  fi

  if [ "$DRY" = 1 ]; then
    echo "[dry-run] render plist -> $PLIST"
  else
    sed -e "s#__RUNNER__#$SHARE/run-agent.sh#" -e "s#__LOGDIR__#$LOGS#" "$ROOT/deploy/agent/com.minidash.agent.plist.tmpl" > "$PLIST"
    plutil -lint "$PLIST" >/dev/null
  fi
  run launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  run launchctl bootstrap "$DOMAIN" "$PLIST"
  say "installed. Token: grep MINIDASH_TOKEN $CONF/agent.env   Logs: $LOGS/agent.log"
}

uninstall() {
  run launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  run rm -f "$PLIST" "$SHARE/minidash-agent" "$SHARE/run-agent.sh"
  say "removed the service. Kept $CONF/agent.env (your token) and $LOGS."
}

case "$CMD" in
  install) install ;;
  uninstall) uninstall ;;
  *) echo "usage: $0 install|uninstall [--dry-run]" >&2; exit 2 ;;
esac
