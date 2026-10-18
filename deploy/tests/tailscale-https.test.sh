#!/usr/bin/env bash
# Tests for deploy/tailscale-https.sh using a stub `tailscale`. No network, no real Tailscale.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$ROOT/deploy/tailscale-https.sh"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# --- stub tailscale ---------------------------------------------------------------------------------
cat > "$WORK/tailscale" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$STUB_LOG"
case "$1 $2" in
  "status --json") echo '{"Self":{"DNSName":"frank.example.ts.net."}}' ;;
  "serve status") cat "${STUB_SERVE_STATUS:-/dev/null}" 2>/dev/null || echo "No serve config" ;;
  "serve --bg")
    if [ "${STUB_MODE:-}" = notenabled ]; then
      printf '\nServe is not enabled on your tailnet.\nTo enable, visit:\n\n         https://login.tailscale.com/f/serve?node=abc123\n\n'
      sleep 60
    fi ;;
  *) : ;;
esac
STUB
chmod +x "$WORK/tailscale"

export TAILSCALE_BIN="$WORK/tailscale" STUB_LOG="$WORK/calls.log" MINIDASH_NO_RESTART=1 MINIDASH_TS_TIMEOUT=2
export MINIDASH_ENV_FILE="$WORK/agent.env"

fresh_env() { printf 'MINIDASH_TOKEN=SECRETTOKENVALUE\nMINIDASH_ADDR=:8787\nMINIDASH_ORIGINS=*:8080\n' > "$MINIDASH_ENV_FILE"; chmod 600 "$MINIDASH_ENV_FILE"; : > "$STUB_LOG"; unset STUB_MODE STUB_SERVE_STATUS; }
origins() { grep '^MINIDASH_ORIGINS=' "$MINIDASH_ENV_FILE"; }
run() { OUTPUT="$("$SCRIPT" "$@" 2>&1)"; CODE=$?; }

pass=0; fail=0
check() { # check "name" condition-command...
  local name="$1"; shift
  if "$@"; then pass=$((pass+1)); echo "  ok   $name"; else fail=$((fail+1)); echo "  FAIL $name"; echo "       output: $OUTPUT" | head -5; fi
}
has() { grep -qF -- "$1" <<<"$OUTPUT"; }
calls() { grep -c -- "$1" "$STUB_LOG" || true; }
mode() { stat -c '%a' "$MINIDASH_ENV_FILE" 2>/dev/null || stat -f '%Lp' "$MINIDASH_ENV_FILE"; } # GNU first, then BSD/macOS

echo "tailscale-https.sh"

# AC-23: dry run changes nothing
fresh_env; run on --dry-run
check "dry run exits 0"                      test "$CODE" = 0
check "dry run says what it would do"        has "[dry-run] would serve https://frank.example.ts.net/"
check "dry run makes no serve changes"       test "$(calls 'serve --bg')" = 0
check "dry run leaves the origins alone"     test "$(origins)" = "MINIDASH_ORIGINS=*:8080"

# enable
fresh_env; run on
check "on exits 0"                           test "$CODE" = 0
check "on serves the UI on HTTPS 443"        grep -qF 'serve --bg --https=443 http://127.0.0.1:8080' "$STUB_LOG"
check "on serves the agent on HTTPS 8787"    grep -qF 'serve --bg --https=8787 http://127.0.0.1:8787' "$STUB_LOG"
check "on allows the HTTPS origin"           test "$(origins)" = "MINIDASH_ORIGINS=*:8080,frank.example.ts.net"
check "on keeps the LAN origin"              has "Plain HTTP on the LAN still works"
check "on keeps the env file private (600)"  test "$(mode)" = 600
check "on keeps the other settings"          grep -q '^MINIDASH_ADDR=:8787$' "$MINIDASH_ENV_FILE"
check "on never prints the token"            bash -c '! grep -qF SECRETTOKENVALUE <<<"$0"' "$OUTPUT"
check "on prints the URL"                    has "https://frank.example.ts.net/"

# idempotent
run on
check "on twice exits 0"                     test "$CODE" = 0
check "on twice does not duplicate origin"   test "$(origins)" = "MINIDASH_ORIGINS=*:8080,frank.example.ts.net"

# disable
run off
check "off exits 0"                          test "$CODE" = 0
check "off turns off 443"                    grep -qF 'serve --https=443 off' "$STUB_LOG"
check "off turns off 8787"                   grep -qF 'serve --https=8787 off' "$STUB_LOG"
check "off removes the origin it added"      test "$(origins)" = "MINIDASH_ORIGINS=*:8080"
check "off leaves the token alone"           grep -q '^MINIDASH_TOKEN=SECRETTOKENVALUE$' "$MINIDASH_ENV_FILE"
run off
check "off twice is safe"                    test "$CODE" = 0

# no ORIGINS line yet
printf 'MINIDASH_TOKEN=SECRETTOKENVALUE\n' > "$MINIDASH_ENV_FILE"; chmod 600 "$MINIDASH_ENV_FILE"; run on
check "on adds an origins line when none"    grep -q '^MINIDASH_ORIGINS=frank.example.ts.net$' "$MINIDASH_ENV_FILE"

# refuses to go public
fresh_env; run on --funnel
check "refuses Funnel (exit 2)"              test "$CODE" = 2
check "refusal changes nothing"              test "$(calls 'serve --bg')" = 0
run on --public
check "refuses --public"                     test "$CODE" = 2

# Funnel already on
fresh_env; printf 'https://frank.example.ts.net (Funnel on)\n|-- / proxy http://127.0.0.1:8080\n' > "$WORK/funnel.txt"; STUB_SERVE_STATUS="$WORK/funnel.txt" run on
check "stops if Funnel is already on (4)"    test "$CODE" = 4
check "Funnel check changes nothing"         test "$(origins)" = "MINIDASH_ORIGINS=*:8080"

# Serve not enabled on the tailnet: explain, change nothing, do not hang
fresh_env; start=$(date +%s); STUB_MODE=notenabled run on; elapsed=$(( $(date +%s) - start ))
check "explains Serve is not enabled (3)"    test "$CODE" = 3
check "prints the link to enable it"         has "https://login.tailscale.com/f/serve?node=abc123"
check "changes nothing when blocked"         test "$(origins)" = "MINIDASH_ORIGINS=*:8080"
check "does not hang"                        test "$elapsed" -lt 15

# status
fresh_env; run on >/dev/null; run status
check "status shows the host"                has "frank.example.ts.net"
check "status says the origin is allowed"    has "allows the origin frank.example.ts.net: yes"
check "status never prints the token"        bash -c '! grep -qF SECRETTOKENVALUE <<<"$0"' "$OUTPUT"

# usage and environment errors
run bogus
check "unknown command exits 2"              test "$CODE" = 2
rm -f "$MINIDASH_ENV_FILE"; run on
check "missing env file explains itself"     has "Install the agent first"
TAILSCALE_BIN=/nonexistent/tailscale run on
check "missing tailscale is reported"        test "$CODE" != 0

echo
echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
