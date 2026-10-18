#!/usr/bin/env bash
# Upgrade a deployed Mac mini with one command. Run it on your development machine, from the repo.
#
#   deploy/upgrade.sh [--host macmini] [--dry-run]
#
# It builds the agent for Apple Silicon, copies the files over SSH, installs the agent (your token is kept),
# rebuilds the web UI container, then CHECKS the agent, the UI and the live stream. It exits non-zero, and does
# not say it succeeded, if any check fails.
#
# Needs: Go and rsync here; SSH access to the host (see the macmini-ssh notes); the host already set up per docs/deploy.md.
# Environment (mostly for tests): MINIDASH_UPGRADE_RETRIES (default 15), MINIDASH_UPGRADE_SLEEP (seconds, default 1).
set -euo pipefail

HOST="macmini"
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:?--host needs a name}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h | --help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "upgrade: unknown option '$1'" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="minidash-staging"
RETRIES="${MINIDASH_UPGRADE_RETRIES:-15}"
SLEEP="${MINIDASH_UPGRADE_SLEEP:-1}"

say() { echo "==> $*"; }
plan() { echo "[dry-run] $*"; }
remote() { ssh -o BatchMode=yes "$HOST" "export PATH=/opt/homebrew/bin:/usr/local/bin:\$PATH; $*"; }

if [ "$DRY" = 1 ]; then
  plan "check SSH access to $HOST"
  plan "build the agent for macOS arm64 -> bin/minidash-agent"
  plan "rsync bin deploy web -> $HOST:$STAGE/ (node_modules and dist excluded)"
  plan "on $HOST: deploy/install-agent.sh install   (keeps your token, restarts the agent)"
  plan "on $HOST: docker compose -f deploy/compose.yaml up -d --build   (rebuilds the UI)"
  plan "check: agent /healthz, UI container running, UI page loads, live stream accepted"
  plan "print the URLs"
  exit 0
fi

command -v go >/dev/null || { echo "upgrade: Go is needed here to build the agent." >&2; exit 1; }
command -v rsync >/dev/null || { echo "upgrade: rsync is needed." >&2; exit 1; }

say "checking SSH access to $HOST"
ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" true || { echo "upgrade: cannot reach $HOST over SSH without a password." >&2; exit 1; }

say "building the agent for Apple Silicon"
(cd "$ROOT/agent" && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -o "$ROOT/bin/minidash-agent" ./cmd/minidash-agent)

say "copying files to $HOST:$STAGE"
ssh -o BatchMode=yes "$HOST" "mkdir -p $STAGE"
(cd "$ROOT" && rsync -az --exclude node_modules --exclude dist bin deploy web "$HOST:$STAGE/")

say "installing the agent on $HOST"
remote "cd $STAGE && chmod +x bin/minidash-agent deploy/install-agent.sh deploy/agent/run-agent.sh && deploy/install-agent.sh install"

say "rebuilding the web UI on $HOST"
remote "cd $STAGE && docker compose -f deploy/compose.yaml up -d --build"

# ---- checks ----------------------------------------------------------------------------------------------
FAILED=0
ok() { echo "  ok    $*"; }
bad() { echo "  FAIL  $*"; FAILED=$((FAILED + 1)); }

# Retries a remote command until it prints the wanted text.
wait_for() { # wait_for "what" "wanted text" "remote command"
  local out=""
  for _ in $(seq 1 "$RETRIES"); do
    out="$(remote "$3" 2>/dev/null || true)"
    if [ "$out" = "$2" ]; then ok "$1"; return 0; fi
    sleep "$SLEEP"
  done
  bad "$1 (wanted '$2', got '${out:-nothing}')"
}

say "checking the result"
wait_for "agent answers /healthz" "ok" "curl -s -m3 http://127.0.0.1:8787/healthz"
wait_for "UI container is running" "running" "docker inspect deploy-web-1 --format '{{.State.Status}}'"
wait_for "UI page loads (HTTP 200)" "200" "curl -s -m3 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/"

# The stream check reads the token over SSH into a variable. It is never printed.
ADDR="$(ssh -G "$HOST" 2>/dev/null | awk '/^hostname /{print $2; exit}')"
ADDR="${ADDR:-$HOST}"
TOKEN="$(remote "grep '^MINIDASH_TOKEN=' ~/.config/minidash/agent.env | cut -d= -f2-" 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then
  bad "could not read the access token on $HOST"
elif MINIDASH_TOKEN="$TOKEN" node "$ROOT/tools/probe.mjs" "ws://$ADDR:8787/ws" 1 cpu >/dev/null 2>&1; then
  ok "live stream accepted and delivering snapshots"
else
  bad "live stream from here to ws://$ADDR:8787/ws"
fi
unset TOKEN

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "upgrade: $FAILED check(s) failed. The upgrade is NOT confirmed. See docs/troubleshooting.md." >&2
  exit 1
fi

LAN_IP="$(remote "ipconfig getifaddr en0" 2>/dev/null || true)"
TS_IP="$(remote "tailscale ip -4" 2>/dev/null | head -1 || true)"
echo
say "upgrade complete and verified. Open the dashboard at:"
echo "    http://$ADDR:8080"
[ -n "$LAN_IP" ] && echo "    http://$LAN_IP:8080"
[ -n "$TS_IP" ] && echo "    http://$TS_IP:8080   (Tailscale)"
echo "    HTTPS over Tailscale: run 'deploy/tailscale-https.sh on' on the mini (see docs/deploy.md)"
echo "    Token: ssh $HOST \"grep MINIDASH_TOKEN ~/.config/minidash/agent.env\""
