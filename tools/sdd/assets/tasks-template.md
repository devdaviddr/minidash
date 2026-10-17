---
feature: {{FEATURE}}
title: {{TITLE}}
version: {{VERSION}}
status: {{STATUS}}
updated: {{UPDATED}}
---

# {{TITLE}} — Task Backlog

> **Stage 3 · BREAK INTO TASKS** — an ordered, testable backlog derived from `spec.md` and `plan.md`
> at this version. Tasks are small, reviewable slices in dependency order. Each cites the FR/AC it
> serves and is independently verifiable. Check items off during Stage 4 (IMPLEMENT).

## How to use
- Work top to bottom; respect `depends on`.
- A task is **done** only when its linked acceptance criteria pass (Stage 5 · TEST).
- If a task reveals a spec gap, update `spec.md`/`plan.md` and **bump the version first** (Stage 6).

## Backlog

| # | Task | Serves | Depends on | Verify by | Done |
| --- | --- | --- | --- | --- | --- |
| T-1 | Scaffold … | FR-1 | — | AC-1 / unit test | [ ] |
| T-2 | Implement … | FR-1 | T-1 | AC-1 | [ ] |
| T-3 | Implement … | FR-2 | T-1 | AC-2 | [ ] |

## Definition of done (this version)
- [ ] Every functional requirement (FR-N) has at least one task.
- [ ] Every acceptance criterion (AC-N) has a verifying test.
- [ ] All tasks checked off and tests passing.
- [ ] `spec.md` and `plan.md` still match what was built (else bump + reconcile).
