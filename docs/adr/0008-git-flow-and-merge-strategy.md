# 8. Trunk-based git flow and merge strategy

Status: Superseded by [0013](0013-git-flow-and-merge-commits.md) (Git Flow with merge commits). The merge-strategy part was first superseded by [ADR 0011](0011-squash-merge-and-labelled-releases.md) (squash every PR).

## Context
The first build was developed as 13 stacked branches that were never merged, which is hard to review and easy to lose.

## Decision
- `main` is the only long-lived branch. It is protected on GitHub: pull request required, the `governance`, `agent` and `web` checks must pass, linear history, no force pushes, no deletion.
- Work happens on short-lived `type/slug` branches cut from current `main`. Branches are not stacked, and are deleted after merge.
- Commits follow Conventional Commits and cite their task (`T-3`) and requirement or acceptance IDs. Git hooks enforce the format and block commits on `main`.
- Merge by **squash** for single-task PRs, and by **rebase-merge** when every commit is atomic and cites its task, so the history is the record. Merge commits are disabled. The PR title is always a Conventional Commit.
- Scope changes go through the spec first: update `spec/`, bump the version, then change code.

## Consequences
A linear, bisectable history on `main`, with CI as the gate. The owner can still merge their own PRs, because required approvals are set to zero and admin enforcement is off.

## Rejected alternatives
- **Merge commits:** non-linear history.
- **Always squash:** would have collapsed the initial 47 task-level commits into one.
- **Gitflow (develop and release branches):** overhead without a release train.
