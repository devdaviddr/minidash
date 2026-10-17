---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 1.0.0
status: approved
updated: 2026-10-18
---
# minidash realtime Mac mini monitor — Task Backlog

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
| T-1 | Scaffold Go agent, Vite/React app, Makefile, CI | FR-8 | — | CI green | [x] |
| T-2 | Snapshot schema + WebSocket hub + reconnecting client | FR-8 | T-1 | AC-8 | [x] |
| T-3 | CPU collector + live CPU view | FR-1 | T-2 | AC-1 | [x] |
| T-4 | Memory + GPU collector (macmon) + views | FR-2, FR-9 | T-2 | AC-2 | [x] |
| T-5 | Disk + external drive collector + view | FR-3 | T-2 | AC-3 | [x] |
| T-6 | Network collector + view | FR-4 | T-2 | AC-4 | [x] |
| T-7 | Process collector + sortable table | FR-5 | T-3 | AC-5 | [x] |
| T-8 | Container collectors (Docker/Podman/Colima) + view | FR-6 | T-2 | AC-6 | [x] |
| T-9 | Shares and accounts collector + view | FR-7 | T-2 | AC-7 | [x] |
| T-10 | Design pass: theme, layout, wall-display mode | NFR UI | T-3..T-9 | visual review by owner | [x] |
| T-11 | launchd packaging and install docs | NFR network | T-1 | manual install on Mac mini | [ ] |

## Definition of done (this version)
- [ ] Every functional requirement (FR-N) has at least one task.
- [ ] Every acceptance criterion (AC-N) has a verifying test.
- [ ] All tasks checked off and tests passing.
- [ ] `spec.md` and `plan.md` still match what was built (else bump + reconcile).