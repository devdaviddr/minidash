#!/usr/bin/env bash
# SessionStart: show the spec state so the gate is visible up front.
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
echo "minidash: branch $(git branch --show-current 2>/dev/null)"
python3 -I "$root/tools/sdd/scripts/spec_tool.py" list 2>/dev/null
open=$(grep -c 'NEEDS INPUT' "$root"/spec/*/spec.md 2>/dev/null | tail -1)
echo "Unresolved [NEEDS INPUT] markers in latest spec: ${open:-0}"
echo "Rules: spec first, Conventional Commits, never commit to main, PRs via ship skill only."
exit 0
