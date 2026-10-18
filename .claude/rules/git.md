# Git

Git Flow, with merge commits. See ADR 0013.

- `main` holds released code only. Every commit on it is a merge of a `release/x.y.z` or `hotfix/x.y.z` branch, tagged `vx.y.z`.
- `develop` is the integration branch. Both `main` and `develop` are protected: no direct commits or pushes, CI (`governance`, `agent`, `web`) must pass.
- Work on `type/short-slug` branches cut from current `develop` (`feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `perf/`, `refactor/`, `test/`). Do not stack branches. Delete the branch after merge.
- Release branches (`release/x.y.z`) are cut from `develop`, carry the changelog and spec status for that version, then merge into `main` and back into `develop`. Hotfix branches (`hotfix/x.y.z`) come off `main` and merge into `main` and back into `develop`. See `docs/releasing.md`.
- Conventional Commits: `type(scope): imperative summary` (max 72 chars). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Body explains why, and cites task/spec IDs.
- Every PR is merged with a **merge commit** (squash and rebase are off), so every branch commit is kept forever. Make each one tidy and meaningful: one logical change, a real message, no "wip", "fixup" or "address review". Tidy your branch before asking for review, not after merge.
- The PR title is still a Conventional Commit. It becomes the merge commit's description and drives the automatic labels and the release notes: use `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `ci` or `chore`, with `!` for a breaking change. Write the title and description for a reader.
- Never `--no-verify`, never force-push shared branches (`main`, `develop`, `release/*`, `hotfix/*`, or any branch with an open PR), never rewrite pushed history.
- Never commit secrets, `.env`, build output, or tool-local files (graphify output, editor state).
- Claude never opens or merges a PR into `main`. Release and hotfix PRs into `main` are opened and merged by the owner via the ship skill.
- Claude may push branches and open PRs into `develop`, but merges one only when the owner asks.
