#!/usr/bin/env bash
# Tests for deploy/upgrade.sh with stubbed ssh, rsync, go and node. No network, no Mac mini.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$ROOT/deploy/upgrade.sh"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

# Every stub records its arguments. ssh answers by what it is asked.
for tool in go rsync node; do
  cat > "$WORK/bin/$tool" <<STUB
#!/usr/bin/env bash
echo "$tool \$*" >> "\$STUB_LOG"
[ "$tool" = node ] && exit "\${STUB_STREAM:-0}"
exit 0
STUB
done
cat > "$WORK/bin/ssh" <<'STUB'
#!/usr/bin/env bash
echo "ssh $*" >> "$STUB_LOG"
all="$*"
case "$all" in
  "-G "* | *" -G "*) echo "hostname mini.example.lan"; exit 0 ;;
  *healthz*) echo "${STUB_HEALTH:-ok}" ;;
  *"docker inspect"*) echo "${STUB_DOCKER:-running}" ;;
  *http_code*) echo "${STUB_HTTP:-200}" ;;
  *MINIDASH_TOKEN=*) [ -n "${STUB_NO_TOKEN:-}" ] || echo "SECRETTOKENVALUE" ;;
  *ipconfig*) echo "192.0.2.10" ;;
  *"tailscale ip"*) echo "100.64.0.1" ;;
  *" true") exit "${STUB_SSH_FAIL:-0}" ;;
esac
exit 0
STUB
chmod +x "$WORK/bin/"*

export STUB_LOG="$WORK/calls.log" MINIDASH_UPGRADE_RETRIES=2 MINIDASH_UPGRADE_SLEEP=0
export PATH="$WORK/bin:$PATH"

fresh() { : > "$STUB_LOG"; unset STUB_HEALTH STUB_DOCKER STUB_HTTP STUB_NO_TOKEN STUB_SSH_FAIL STUB_STREAM; }
run() { OUTPUT="$("$SCRIPT" "$@" 2>&1)"; CODE=$?; }
pass=0; fail=0
check() { local name="$1"; shift; if "$@"; then pass=$((pass+1)); echo "  ok   $name"; else fail=$((fail+1)); echo "  FAIL $name"; echo "       output: $OUTPUT" | head -6; fi; }
has() { grep -qF -- "$1" <<<"$OUTPUT"; }
logged() { grep -qF -- "$1" "$STUB_LOG"; }
nolog() { ! grep -qF -- "$1" "$STUB_LOG"; }

echo "upgrade.sh"

# AC-24: dry run
fresh; run --dry-run
check "dry run exits 0"                       test "$CODE" = 0
check "dry run prints the plan"               has "[dry-run] rsync bin deploy web"
check "dry run touches nothing"               test ! -s "$STUB_LOG"
run --bogus
check "unknown option exits 2"                test "$CODE" = 2

# AC-24: success path
fresh; run
check "success exits 0"                       test "$CODE" = 0
check "success says it is verified"           has "upgrade complete and verified"
check "prints the hostname URL"               has "http://mini.example.lan:8080"
check "prints the LAN IP URL"                 has "http://192.0.2.10:8080"
check "prints the Tailscale URL"              has "http://100.64.0.1:8080   (Tailscale)"
check "points to the HTTPS script"            has "tailscale-https.sh on"
check "builds the agent"                      logged "go build"
check "copies the files"                      logged "rsync -az --exclude node_modules --exclude dist bin deploy web macmini:minidash-staging/"
check "installs the agent"                    logged "deploy/install-agent.sh install"
check "rebuilds the UI"                       logged "docker compose -f deploy/compose.yaml up -d --build"
check "remote commands get the Homebrew PATH" logged "/opt/homebrew/bin"
check "never prints the token"                bash -c '! grep -qF SECRETTOKENVALUE <<<"$0"' "$OUTPUT"
check "never passes the token as an argument" nolog "SECRETTOKENVALUE"
check "checks the live stream"                logged "node $ROOT/tools/probe.mjs ws://mini.example.lan:8787/ws 1 cpu"

# AC-24: refuses to claim success when a check fails
fresh; STUB_HEALTH=nope run
check "unhealthy agent: exits 1"              test "$CODE" = 1
check "unhealthy agent: names the failure"    has "FAIL  agent answers /healthz"
check "unhealthy agent: not confirmed"        has "NOT confirmed"
check "unhealthy agent: no success message"   bash -c '! grep -qF "upgrade complete" <<<"$0"' "$OUTPUT"

fresh; STUB_DOCKER=exited run
check "stopped UI container: exits 1"         test "$CODE" = 1
check "stopped UI container: named"           has "FAIL  UI container is running"

fresh; STUB_HTTP=502 run
check "UI page failing: exits 1"              test "$CODE" = 1

fresh; STUB_STREAM=1 run
check "stream rejected: exits 1"              test "$CODE" = 1
check "stream rejected: named"                has "FAIL  live stream"

fresh; STUB_NO_TOKEN=1 run
check "no token readable: exits 1"            test "$CODE" = 1
check "no token readable: explained"          has "could not read the access token"

# early failures stop before changing anything
fresh; STUB_SSH_FAIL=1 run
check "SSH unreachable: exits 1"              test "$CODE" = 1
check "SSH unreachable: explained"            has "cannot reach macmini over SSH"
check "SSH unreachable: nothing built"        nolog "go build"
check "SSH unreachable: nothing copied"       nolog "rsync"

fresh; run --host other-mac
check "--host is used for every command"      logged "ssh -o BatchMode=yes other-mac"
check "--host is used for the copy"           logged "other-mac:minidash-staging/"

echo
echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
