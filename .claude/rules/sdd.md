# Spec-driven development

Flow: SPECIFY -> PLAN -> TASKS -> IMPLEMENT -> TEST -> MAINTAIN. Artifacts are `spec/<semver>/{spec,plan,tasks}.md`.

- Do not write or edit files under `agent/`, `web/`, `src/` unless the current spec's status is `approved` or `implemented` (a hook enforces this).
- Work tasks in `tasks.md` order. Cite `FR-N`/`AC-N`/`T-N` in commits and tests.
- Every acceptance criterion needs an automated check, or a documented manual check when it needs a real Mac.
- Scope change: ask the owner about new unknowns, update the artifacts, run `spec_tool.py bump` (MAJOR breaks, MINOR adds, PATCH words), then write code.
- Never approve a spec while `[NEEDS INPUT]` markers or open questions remain, unless the owner defers each with a name.
- Do not edit a frozen older version directory.
