#!/usr/bin/env bash
# Publish the dashboard over HTTPS to your Tailscale tailnet (and only your tailnet).
#
#   deploy/tailscale-https.sh on      [--dry-run]
#   deploy/tailscale-https.sh off     [--dry-run]
#   deploy/tailscale-https.sh status
#
# Run it ON the Mac mini. It uses `tailscale serve`, so Tailscale issues and renews the certificates; there is
# nothing to manage. It sets up:
#   https://<host>.ts.net/ and /history -> the web UI      (127.0.0.1:8080)
#   https://<host>.ts.net/ws      -> the agent's stream (127.0.0.1:8787/ws); the UI connects with wss://<host>.ts.net/ws
# /history goes to the UI too, so nginx proxies it to the agent and the page keeps one origin.
# Only port 443 is served: serving the agent's own port would take that port from the agent (ADR 0016).
# and adds <host>.ts.net to the agent's allowed origins (MINIDASH_ORIGINS), then restarts the agent.
# Plain HTTP on the LAN is left exactly as it was. Funnel (public internet) is never used.
#
# Needs "Serve" enabled once for your tailnet (an account setting): the script prints the link if it is not.
# Environment (mostly for tests): TAILSCALE_BIN, MINIDASH_ENV_FILE, MINIDASH_UI_PORT, MINIDASH_AGENT_PORT,
# MINIDASH_NO_RESTART=1 (do not restart the agent), MINIDASH_TS_TIMEOUT (seconds to wait for tailscale, default 15).
set -euo pipefail

CMD="${1:-}"; shift || true
DRY=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --funnel | funnel | --public) echo "tailscale-https: refusing. This dashboard is for your tailnet only; Funnel (public internet) is never used." >&2; exit 2 ;;
    *) echo "tailscale-https: unknown option '$a'" >&2; exit 2 ;;
  esac
done

UI_PORT="${MINIDASH_UI_PORT:-8080}"
AGENT_PORT="${MINIDASH_AGENT_PORT:-8787}"
ENV_FILE="${MINIDASH_ENV_FILE:-$HOME/.config/minidash/agent.env}"
LABEL=com.minidash.agent

say() { echo "tailscale-https: $*"; }
die() { echo "tailscale-https: $*" >&2; exit "${2:-1}"; }

find_tailscale() {
  if [ -n "${TAILSCALE_BIN:-}" ]; then echo "$TAILSCALE_BIN"; return; fi
  for c in tailscale /opt/homebrew/bin/tailscale /usr/local/bin/tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale; do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
  done
}
TS="$(find_tailscale)"
[ -n "$TS" ] || die "tailscale not found. Install it and sign in first."

# Runs a command with a time limit (macOS has no `timeout`). Output goes to $OUT. Returns the command's status.
OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
limited() {
  perl -e 'my $t = shift; my $pid = fork();
    if (!$pid) { exec @ARGV or exit 127 }
    $SIG{ALRM} = sub { kill "TERM", $pid; sleep 1; kill "KILL", $pid; waitpid($pid, 0); exit 124 };
    alarm $t; waitpid($pid, 0); exit($? >> 8)' "$@" >"$OUT" 2>&1
}

host() {
  "$TS" status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null
}
HOST="$(host || true)"
[ -n "$HOST" ] || die "could not read this machine's Tailscale name. Is Tailscale running and signed in?"

act() { # act "description" cmd...   (honours --dry-run)
  local desc="$1"; shift
  if [ "$DRY" = 1 ]; then echo "[dry-run] $desc"; else say "$desc"; "$@"; fi
}

# ---- the agent's allowed origins -------------------------------------------------------------------------
origins_line() { grep -E '^MINIDASH_ORIGINS=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

write_origins() { # $1 = new value; keeps the file's mode, never prints other lines (the token lives there)
  local value="$1" tmp
  [ -f "$ENV_FILE" ] || die "missing $ENV_FILE. Install the agent first: deploy/install-agent.sh install" 1
  tmp="$(mktemp)"
  if grep -qE '^MINIDASH_ORIGINS=' "$ENV_FILE"; then
    sed -e "s#^MINIDASH_ORIGINS=.*#MINIDASH_ORIGINS=$value#" "$ENV_FILE" > "$tmp"
  else
    { cat "$ENV_FILE"; echo "MINIDASH_ORIGINS=$value"; } > "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE" # write in place so the mode and owner are kept
  rm -f "$tmp"
}

add_origin() {
  local cur; cur="$(origins_line)"
  case ",$cur," in *",$HOST,"*) say "origin $HOST already allowed"; return ;; esac
  write_origins "${cur:+$cur,}$HOST"
}

remove_origin() {
  local cur out="" part; cur="$(origins_line)"
  [ -n "$cur" ] || return 0
  local IFS=','
  for part in $cur; do [ "$part" = "$HOST" ] || out="${out:+$out,}$part"; done
  write_origins "$out"
}

restart_agent() {
  if [ "${MINIDASH_NO_RESTART:-0}" = 1 ]; then say "(agent restart skipped)"; return; fi
  launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || say "could not restart the agent; restart it yourself: launchctl kickstart -k gui/\$(id -u)/$LABEL"
}

serve_on() { # $1 = path on https 443, $2 = local target URL
  local rc=0
  # A non-zero status (including a timeout) is handled below, so it must not trip `set -e`.
  if [ "$1" = / ]; then
    limited "${MINIDASH_TS_TIMEOUT:-15}" "$TS" serve --bg --https=443 "$2" || rc=$?
  else
    limited "${MINIDASH_TS_TIMEOUT:-15}" "$TS" serve --bg --https=443 "--set-path=$1" "$2" || rc=$?
  fi
  if grep -qi "not enabled on your tailnet" "$OUT"; then
    echo "tailscale-https: Tailscale Serve is not enabled on your tailnet yet. This is an account setting only you can change." >&2
    grep -Eo 'https://login\.tailscale\.com[^ ]*' "$OUT" | head -1 | sed 's/^/tailscale-https: Enable it here, then run this again: /' >&2
    exit 3
  fi
  if grep -qi "https.*not enabled\|enable https" "$OUT"; then
    echo "tailscale-https: HTTPS certificates are not enabled for your tailnet. Enable 'HTTPS Certificates' in the Tailscale admin console (DNS page), then run this again." >&2
    exit 3
  fi
  [ "$rc" = 0 ] || { cat "$OUT" >&2; die "tailscale serve failed (status $rc)" 1; }
}

no_funnel() {
  if "$TS" serve status 2>/dev/null | grep -qi "funnel on"; then
    die "Funnel (public internet) is on for this machine. Turn it off with: tailscale funnel reset" 4
  fi
}

case "$CMD" in
  on)
    no_funnel
    if [ "$DRY" = 1 ]; then
      echo "[dry-run] would serve https://$HOST/ and /history -> http://127.0.0.1:$UI_PORT"
      echo "[dry-run] would serve https://$HOST/ws -> http://127.0.0.1:$AGENT_PORT/ws"
      echo "[dry-run] would allow the origin $HOST in $ENV_FILE and restart the agent"
      exit 0
    fi
    # Serve first: if it is not enabled we stop here and have changed nothing.
    # A serve on the agent's port from an older version takes that port from the agent; drop it first.
    limited "${MINIDASH_TS_TIMEOUT:-15}" "$TS" serve "--https=$AGENT_PORT" off >/dev/null 2>&1 || true
    serve_on / "http://127.0.0.1:$UI_PORT"
    serve_on /history "http://127.0.0.1:$UI_PORT"
    serve_on /ws "http://127.0.0.1:$AGENT_PORT/ws"
    no_funnel
    add_origin
    restart_agent
    say "done. Open https://$HOST/ from any device on your tailnet."
    say "The page connects to wss://$HOST/ws and fetches /history from the same origin. Plain HTTP on the LAN still works."
    ;;
  off)
    if [ "$DRY" = 1 ]; then
      echo "[dry-run] would turn off the HTTPS serve on 443 (and any older serve on $AGENT_PORT), remove the origin $HOST, restart the agent"
      exit 0
    fi
    limited "${MINIDASH_TS_TIMEOUT:-15}" "$TS" serve "--https=443" off || true
    limited "${MINIDASH_TS_TIMEOUT:-15}" "$TS" serve "--https=$AGENT_PORT" off || true
    remove_origin
    restart_agent
    say "HTTPS over Tailscale is off. The LAN HTTP addresses are unchanged."
    ;;
  status)
    say "this machine: $HOST"
    "$TS" serve status 2>&1 || true
    cur="$(origins_line)"
    case ",$cur," in *",$HOST,"*) say "agent allows the origin $HOST: yes" ;; *) say "agent allows the origin $HOST: no" ;; esac
    ;;
  *)
    echo "usage: $0 on|off|status [--dry-run]" >&2
    exit 2
    ;;
esac
