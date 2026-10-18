# 11. Squash-merge every PR, label PRs automatically, release by tag

Status: Superseded by [0013](0013-git-flow-and-merge-commits.md) (squash merging only; the labels, release notes and release-by-tag parts still stand). Supersedes the merge-strategy decision in [ADR 0008](0008-git-flow-and-merge-strategy.md).

## Context
ADR 0008 allowed squash or rebase-merge, with rebase for large PRs whose commits were each atomic. In practice the first large PR went in as 47 commits and the next as one squash commit, and the squashed history was easier to read: one entry per change, each with a real title and description. The owner wants a tidy branch list, scannable pull requests and proper releases.

## Decision
- **Squash every PR.** It is the only merge button (rebase and merge commits are off). GitHub builds the commit on `main` from the **PR title and the PR description**, so those are written for a reader and become the history and the release note. Commits inside a branch stay Conventional (the hooks still enforce it) but are squashed away.
- **Label PRs automatically.** A workflow reads the Conventional Commit title and sets one type label (`feature`, `fix`, `performance`, `refactor`, `documentation`, `test`, `ci`, `chore`), `breaking` for a `!`, `dependencies` for dependency updates, and a size label (`size/XS` to `size/XL`). Lockfiles and images do not count toward size. The labelling logic is a small pure module with tests.
- **Group release notes by type.** `.github/release.yml` maps those labels to headings (Breaking changes, Features, Fixes, Performance, Refactoring, Documentation, Tests and CI, Dependencies, Other).
- **Release by tag, named after the spec version.** Pushing `vX.Y.Z` runs a workflow that tests, builds the agent for Apple Silicon and the web UI, writes checksums, and publishes a GitHub Release with grouped notes. Releases are created as **pre-releases** and promoted by hand after review. See [docs/releasing.md](../releasing.md).

## Consequences
- `main` has one clean commit per PR, linear and bisectable at the PR level.
- Step-by-step history inside a large PR is not kept on `main`. The PR page, the spec and the tasks still record it, and the branch commits remain visible on the PR until it is deleted.
- Release notes need correct PR titles, which the existing title check already enforces, plus the automatic labels.
- The labelling workflow uses `pull_request_target` so it can label PRs from forks. It runs only the base branch's code and never checks out or runs the PR's code.
- The release workflow runs in the repository's CI on a tag, so a tag at a commit without the workflow does not publish. Releases before this change were created by hand.

## Rejected alternatives
- **Rebase-merge for big PRs:** keeps every step, but main read as a long list of small commits with little context, and it needed a judgement call each time.
- **Merge commits:** non-linear history.
- **Hand-written release notes only:** easy to forget and inconsistent. The generated notes are the base, with a short header added by the workflow.
- **Releasing on every merge:** too many releases. A release is a deliberate act on a tag.
