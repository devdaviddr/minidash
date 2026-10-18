<!--
Open feature PRs into develop. PRs into main come only from release/* or hotfix/* branches.
The PR TITLE is the release note, and with this DESCRIPTION it goes on the merge commit.
Every branch commit is kept (merge commits, no squash), so tidy them before review.
Write the title and description for someone reading the history. The title must be a Conventional Commit:
feat | fix | perf | refactor | docs | test | ci | chore, with "!" for a breaking change.
Labels (type and size) are added automatically.
-->

## What and why

## Spec
Spec version: `x.y.z`  Tasks: T-?  Requirements: FR-?  Acceptance: AC-?

## How it was checked

## Not verified / needs a human

## Checklist
- [ ] Title is a Conventional Commit
- [ ] Base is `develop` (or `main` for a release/hotfix branch); branch commits are tidy
- [ ] Spec/plan/tasks updated (and version bumped) if scope changed
- [ ] Tests cover the cited acceptance criteria
- [ ] Docs / ADR updated
- [ ] No secrets, real hostnames, IPs or share names
