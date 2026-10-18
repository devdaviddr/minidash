# Git

- `main` is protected by convention: no direct commits or pushes. Work on `type/short-slug` branches (`feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`).
- Conventional Commits: `type(scope): imperative summary` (max 72 chars). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Body explains why, and cites task/spec IDs.
- Keep branch commits tidy: one logical change each, no "wip". They are squashed on merge, but they are what you and reviewers read while the PR is open.
- Never `--no-verify`, never force-push shared branches, never rewrite pushed history.
- Never commit secrets, `.env`, build output, or tool-local files (graphify output, editor state).
- PRs into `main` are opened and merged only by the owner via the ship skill. Claude pushes branches and stops.
- Every PR is **squash-merged** (the only merge button). The PR title (a Conventional Commit) and description become the commit on `main` and the release note, so write them for a reader. Commits inside a branch must still be Conventional (the hooks enforce it) but are squashed away. See ADR 0011.
- PR titles drive automatic labels and release notes: use `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `ci` or `chore`, with `!` for a breaking change.
- Delete the branch after merge. Branches are short-lived and based on current `main`; do not stack branches.
