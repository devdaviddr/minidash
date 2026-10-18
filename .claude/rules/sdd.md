# Spec-driven development

Flow: SPECIFY -> PLAN -> TASKS -> IMPLEMENT -> TEST -> MAINTAIN. Artifacts are `spec/<semver>/{spec,plan,tasks}.md`.

- Do not write or edit files under `agent/`, `web/`, `src/` unless the current spec's status is `approved` or `implemented` (a hook enforces this).
- Work tasks in `tasks.md` order. Cite `FR-N`/`AC-N`/`T-N` in commits and tests.
- Every acceptance criterion needs an automated check, or a documented manual check when it needs a real Mac.
- Scope change: ask the owner about new unknowns, update the artifacts, run `spec_tool.py bump` (MAJOR breaks, MINOR adds, PATCH words), then write code.
- Never approve a spec while `[NEEDS INPUT]` markers or open questions remain, unless the owner defers each with a name.
- Do not edit a frozen older version directory.

## Pre-1.0 versions
The project stays below 1.0.0 until the owner declares it stable (ADR 0013). Until then the spec version is the release version:
- Each release is a MINOR. Start it on `develop` with `spec_tool.py bump minor --status draft`, so it gets its own spec, plan and tasks. Never `bump major`.
- Approve the current spec by setting `status: approved` in its `spec.md`, without a bump. Scope changes before that version is released are made in the current directory; after release they go into the next MINOR.
- The release branch sets `status: implemented`. Hotfixes are a PATCH release and get no spec directory.
