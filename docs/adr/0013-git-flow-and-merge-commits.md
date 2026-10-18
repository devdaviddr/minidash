# 13. Git Flow with merge commits, and pre-1.0 versioning

Status: accepted. Supersedes the branching decision in [ADR 0008](0008-git-flow-and-merge-strategy.md) and the squash decision in [ADR 0011](0011-squash-merge-and-labelled-releases.md). The automatic labels, grouped release notes and release-by-tag parts of ADR 0011 still stand.

## Context
Under ADR 0011 every PR was squashed onto `main`, which was also where work landed day to day. Two problems showed up. Squashing threw away the step-by-step commits of larger changes, each of which cited its task, so `main` no longer showed how a feature was built. And with a single branch there was no line between "merged" and "released": `main` mixed shipped code with work waiting for the next release, and a hotfix for a published version had nowhere clean to go.

Versions needed a rule too. The spec tool's usual flow bumps MAJOR when a spec is approved, which would have reached 1.0.0 while the project was still changing shape from release to release. The history was rebuilt before 0.5.0, with every past release numbered below 1.0.

## Decision
- **Git Flow.**
  - `main` holds released code only. Every commit on `main` is a merge of `release/x.y.z` or `hotfix/x.y.z`, tagged `vx.y.z`.
  - `develop` is the integration branch.
  - Work happens on short-lived `type/slug` branches (`feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `perf/`, `refactor/`, `test/`) cut from `develop`, with PRs into `develop`.
  - A release branch is cut from `develop`, carries the version's changelog and spec status, merges into `main` (tagged) and back into `develop`.
  - A hotfix branch comes off `main`, merges into `main` (tagged) and back into `develop`.
- **Merge commits only.** Squash and rebase merging are off. Every branch commit is kept, so branch commits must be tidy and meaningful. The PR title is still a Conventional Commit; it drives the labels and release notes as in ADR 0011.
- **Protection.** `main` and `develop` are both protected: PR required, the `governance`, `agent` and `web` checks must pass, no force pushes, no deletion. Linear history is no longer required. CI also checks that PRs into `main` come from `release/*` or `hotfix/*`.
- **Who merges.** The owner opens and merges release and hotfix PRs into `main` with the ship skill. Claude may open PRs into `develop` and merges them only when the owner asks.
- **Pre-1.0 versioning.**
  - The project stays below 1.0.0 until the owner declares it stable.
  - Each release is a MINOR bump (`0.5.0`, `0.6.0`), with a spec directory of the same number holding its own spec, plan and tasks.
  - A hotfix is a PATCH (`0.4.1`) and needs no new spec directory.
  - The spec version equals the release version.

## Consequences
- The full history of each change is kept and bisectable down to the task commit. The merge commits mark where each PR, release and hotfix landed.
- History on `main` and `develop` is no longer linear; `git log --first-parent` gives the one-line-per-PR view squashing used to give.
- `main` always matches the latest release, so the tag, the code and the spec on `main` agree.
- A release takes more steps: cut the branch, open the PR, merge, tag, merge back. [docs/releasing.md](../releasing.md) lists them.
- Release notes are generated from the PRs merged between two tags, which now includes the feature PRs into `develop`. The release PR itself (`chore(release): x.y.z`) and merge-back PRs are labelled `release` and left out of the notes.
- Sloppy branch commits now stay in the history for good, so they get reviewed with the PR.

## Rejected alternatives
- **Keep squash on a single `main`:** simple, but loses task-level history and has no place for hotfixes to a released version.
- **Squash into `develop`, merge into `main`:** keeps `main` readable but still loses the task-level commits.
- **Rebase-merge:** keeps commits but rewrites them, so the commits on the PR are not the commits on the branch, and there is no marker for where a PR starts and ends.
- **Stay on 1.x:** the numbers would claim a stability the project does not have yet.
