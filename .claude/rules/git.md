# Git

- `main` is protected by convention: no direct commits or pushes. Work on `type/short-slug` branches (`feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`).
- Conventional Commits: `type(scope): imperative summary` (max 72 chars). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Body explains why, and cites task/spec IDs.
- One logical change per commit. No "wip", no mixed refactor and feature.
- Never `--no-verify`, never force-push shared branches, never rewrite pushed history.
- Never commit secrets, `.env`, build output, or tool-local files (graphify output, editor state).
- PRs into `main` are opened and merged only by the owner via the ship skill. Claude pushes branches and stops.
- `main` stays linear. Squash-merge single-task PRs. Rebase-merge a PR whose commits are each atomic, Conventional and cite their task (the initial build): the history is the record. Either way the PR title is a Conventional Commit.
- Delete the branch after merge. Branches are short-lived and based on current `main`; do not stack branches.
