---
name: commit
description: Make a git commit in minidash that follows the repo's rules: Conventional Commit message, task IDs, docs updated, on a feature branch. Use whenever committing or pushing a branch.
---

# minidash commit

1. `git branch --show-current`. If `main` or `develop`, create `type/short-slug` from current `develop` first.
2. `git status` and `git diff --staged`. One logical change only; split otherwise. Stage files by name. Branch commits are kept forever (merge commits, no squash), so each must be tidy and meaningful.
3. Check: docs updated for user-visible or architectural change? ADR needed? Tests for the cited AC? No secrets or real hostnames/IPs/share names in fixtures?
4. Message: `type(scope): imperative summary` under 72 chars, blank line, why, then `Refs: T-3, FR-1, AC-1`. End with the Co-Authored-By trailer the session specifies.
5. Commit without `--no-verify` (the `.githooks` commit-msg hook validates the format). Fix and retry on failure; never bypass.
6. Push the branch with `git push -u origin <branch>`. A PR, if wanted, goes into `develop` with a Conventional Commit title; merge it only when the owner asks. Never open or merge a PR into `main`: release and hotfix PRs are the owner's, via the ship skill.
