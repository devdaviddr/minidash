---
name: spec
description: Work on minidash's spec-driven workflow: draft or revise spec/plan/tasks, resolve [NEEDS INPUT] questions, bump the spec version, or check what is approved. Use before any feature work, scope change, or when asked what to build next.
---

# minidash spec workflow

1. `python3 -I tools/sdd/scripts/spec_tool.py list` to see the current version and status.
2. Draft: fill `spec/<current>/{spec,plan,tasks}.md`. Ask the owner about every `[NEEDS INPUT]` in one grouped round; never guess.
3. Approve only when no markers or open questions remain: `spec_tool.py bump major --note "Approved" --status approved`.
4. After approval, take the next unchecked task in `tasks.md`; cite `FR-N`, `AC-N`, `T-N` in commits and tests.
5. Scope change: ask, update artifacts, `bump minor|major` first, then code.
6. When every AC passes: `bump minor --status implemented`.

Rules: `.claude/rules/sdd.md`. Older version directories are frozen.
