#!/usr/bin/env bash
# PreToolUse(Edit|Write): no app code before an approved spec; frozen spec versions are read-only.
set -u
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
file=$(python3 -I -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')
# macOS paths are case-insensitive; compare lowercased so /Projects and /projects match.
lroot=$(printf %s "$root" | tr '[:upper:]' '[:lower:]')
lfile=$(printf %s "$file" | tr '[:upper:]' '[:lower:]')
rel=${lfile#"$lroot"/}

current=$(ls -1 "$root/spec" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
status=$(sed -n 's/^status: *//p' "$root/spec/$current/spec.md" 2>/dev/null | head -1)

block() { echo "minidash spec gate: $1 (see .claude/rules/sdd.md)" >&2; exit 2; }

if [[ "$rel" =~ ^spec/([0-9]+\.[0-9]+\.[0-9]+)/ && "${BASH_REMATCH[1]}" != "$current" ]]; then
  block "spec/${BASH_REMATCH[1]} is frozen history; edit spec/$current or bump"
fi

if [[ "$rel" =~ ^(agent|web|src|cmd|internal)/ ]]; then
  [[ "$status" == "approved" || "$status" == "implemented" ]] \
    || block "spec $current is '${status:-missing}'; get it approved before writing app code"
fi
exit 0
