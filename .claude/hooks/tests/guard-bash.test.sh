#!/usr/bin/env bash
# Tests for .claude/hooks/guard-bash.sh. Feeds it PreToolUse JSON on stdin, as Claude Code does,
# with a stubbed gh on PATH. No network, no GitHub.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$ROOT/.claude/hooks/guard-bash.sh"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

# gh pr view answers with $STUB_BASE (empty means "no PR found") and logs its arguments.
cat > "$WORK/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "gh $*" >> "$STUB_LOG"
[ -n "${STUB_BASE:-}" ] || { echo "no pull requests found" >&2; exit 1; }
echo "$STUB_BASE"
STUB
chmod +x "$WORK/bin/gh"
export STUB_LOG="$WORK/gh.log"

fails=0
# run <expected exit> <description> <command>
run() {
  local want=$1 desc=$2 command=$3 got
  : > "$STUB_LOG"
  python3 -I -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$command" \
    | (cd "$WORK" && PATH="$WORK/bin:$PATH" bash "$HOOK") 2>/dev/null
  got=$?
  if [ "$got" = "$want" ]; then echo "ok   $desc"; else echo "FAIL $desc (exit $got, want $want)"; fails=$((fails + 1)); fi
}

run 0 "create with --base develop is allowed" 'gh pr create --base develop --title "chore: x" --body "y"'
run 0 "create with --base=develop is allowed" 'gh pr create --base=develop --fill'
run 0 "create with -B develop is allowed" 'gh pr create -B develop --fill'
run 2 "create with --base main is blocked" 'gh pr create --base main --fill'
run 2 "create with -B main is blocked" 'gh pr create -B main --fill'
run 2 "create with no base is blocked" 'gh pr create --title "chore: x" --body "y"'
run 2 "create with base in body only is blocked" 'gh pr create --fill --body "use --base develop"'

STUB_BASE=main run 2 "merge into main is blocked" 'gh pr merge 12 --merge'
STUB_BASE=develop run 0 "merge into develop is allowed" 'gh pr merge 12 --merge --delete-branch'
grep -q "gh pr view 12 --json baseRefName" "$STUB_LOG" || { echo "FAIL merge did not look up PR 12"; fails=$((fails + 1)); }
STUB_BASE=develop run 0 "merge of the current branch's PR into develop is allowed" 'gh pr merge --merge'
STUB_BASE=main run 2 "merge with flags before the number is checked" 'gh pr merge --body "a b" 12 --merge'
grep -q "gh pr view 12 " "$STUB_LOG" || { echo "FAIL merge did not skip the --body value"; fails=$((fails + 1)); }
STUB_BASE= run 2 "merge with unknown base is blocked" 'gh pr merge 99 --merge'

run 2 "force push is still blocked" 'git push --force origin feat/x'
run 0 "an unrelated command is allowed" 'ls -la'

if [ "$fails" -gt 0 ]; then echo "$fails failed"; exit 1; fi
echo "all passed"
