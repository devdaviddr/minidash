#!/usr/bin/env bash
# PreToolUse(Bash): enforce .claude/rules/git.md. Exit 2 blocks the call.
set -u
cmd=$(python3 -I -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))')
branch=$(git branch --show-current 2>/dev/null || true)

block() { echo "minidash guard: $1 (see .claude/rules/git.md)" >&2; exit 2; }

# The arguments after "$1" in $cmd, up to the next shell separator, one per line (shell quoting honoured).
args_after() {
  local rest=${cmd#*"$1"}
  rest=${rest%%[;&|$'\n']*}
  python3 -I -c 'import shlex,sys; print("\n".join(shlex.split(sys.argv[1])))' "$rest" 2>/dev/null
}

case "$cmd" in
  *"--no-verify"*|*"--no-gpg-sign"*) block "never skip git hooks" ;;
  *"push --force"*|*"push -f"*|*"--force-with-lease"*) block "no force pushes" ;;
esac

# PRs into develop are fine; PRs into main are the owner's, via the ship skill.
if [[ "$cmd" == *"gh pr create"* ]]; then
  base="" next=""
  while IFS= read -r a; do
    if [[ -n "$next" ]]; then base=$a; next=""; continue; fi
    case "$a" in
      --base|-B) next=1 ;;
      --base=*) base=${a#--base=} ;;
      -B?*) base=${a#-B} ;;
    esac
  done < <(args_after "gh pr create")
  [[ "$base" == "develop" ]] || block "open PRs with --base develop; PRs into main are opened by the owner via the ship skill"
fi

if [[ "$cmd" == *"gh pr merge"* ]]; then
  sel="" repo="" skip="" next=""
  while IFS= read -r a; do
    if [[ -n "$next" ]]; then repo=$a; next=""; continue; fi
    if [[ -n "$skip" ]]; then skip=""; continue; fi
    case "$a" in
      -R|--repo) next=1 ;;
      --repo=*) repo=${a#--repo=} ;;
      -b|--body|-F|--body-file|-t|--subject|-A|--author-email|--match-head-commit) skip=1 ;;
      -*) ;;
      *) [[ -n "$sel" ]] || sel=$a ;;
    esac
  done < <(args_after "gh pr merge")
  base=$(gh pr view ${sel:+"$sel"} ${repo:+--repo "$repo"} --json baseRefName -q .baseRefName 2>/dev/null)
  [[ -n "$base" ]] || block "cannot tell the PR's base branch, so not merging"
  [[ "$base" != "main" ]] || block "PRs into main are merged by the owner via the ship skill"
fi

if [[ "$cmd" == *"git commit"* || "$cmd" == *"git push"* ]] && [[ "$branch" == "main" ]]; then
  block "do not commit or push on main; create a type/slug branch"
fi
if [[ "$cmd" =~ git\ push.*(origin\ main|HEAD:main) ]]; then
  block "do not push to main"
fi
exit 0
