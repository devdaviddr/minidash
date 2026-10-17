#!/usr/bin/env bash
# PreToolUse(Bash): enforce .claude/rules/git.md. Exit 2 blocks the call.
set -u
cmd=$(python3 -I -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))')
branch=$(git branch --show-current 2>/dev/null || true)

block() { echo "minidash guard: $1 (see .claude/rules/git.md)" >&2; exit 2; }

case "$cmd" in
  *"--no-verify"*|*"--no-gpg-sign"*) block "never skip git hooks" ;;
  *"push --force"*|*"push -f"*|*"--force-with-lease"*) block "no force pushes" ;;
  *"gh pr create"*|*"gh pr merge"*) block "PRs into main are opened and merged by the owner via the ship skill" ;;
esac

if [[ "$cmd" == *"git commit"* || "$cmd" == *"git push"* ]] && [[ "$branch" == "main" ]]; then
  block "do not commit or push on main; create a type/slug branch"
fi
if [[ "$cmd" =~ git\ push.*(origin\ main|HEAD:main) ]]; then
  block "do not push to main"
fi
exit 0
