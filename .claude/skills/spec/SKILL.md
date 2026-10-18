---
name: spec
description: Work on minidash's spec-driven workflow: draft or revise spec/plan/tasks, resolve [NEEDS INPUT] questions, bump the spec version, or check what is approved. Use before any feature work, scope change, or when asked what to build next.
---

# minidash spec workflow

1. `python3 -I tools/sdd/scripts/spec_tool.py list` to see the current version and status.
2. Draft: fill `spec/<current>/{spec,plan,tasks}.md`. Ask the owner about every `[NEEDS INPUT]` in one grouped round; never guess.
3. Approve only when no markers or open questions remain: set `status: approved` in the current `spec.md` (no bump; pre-1.0 the spec version is the release version, see `.claude/rules/sdd.md`).
4. After approval, take the next unchecked task in `tasks.md`; cite `FR-N`, `AC-N`, `T-N` in commits and tests.
5. Scope change: ask, update artifacts, then code. Before the current version is released, change it in place; after release, start the next version with `bump minor --status draft`. Never `bump major` before 1.0.0.
6. When every AC passes, the release branch (`release/x.y.z`) sets `status: implemented`; see `docs/releasing.md`.

Rules: `.claude/rules/sdd.md`. Older version directories are frozen.
