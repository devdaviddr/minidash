---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 1.3.0
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
| T-11 | launchd packaging and install docs | NFR network | T-1 | manual install on Mac mini | [x] |
| T-12 | Design tokens and theme system: `data-theme`, System/Light/Dark switch, `theme-init.js`, chart re-theme | FR-10, FR-11 | T-10 | AC-9 | [x] |
| T-13 | Restyle shell and cards to the illustration (brand mark, pill, summary strip, card type, gradient charts) in both themes; contrast test | FR-11 | T-12 | AC-10, owner visual review | [x] |
| T-14 | Layout model: types, defaults, validator, reducer, storage with fallbacks (pure, unit-tested) | FR-12..FR-16 | T-10 | AC-15 (model half), AC-17 | [x] |
| T-15 | Card registry and grid rendered from the layout: visibility, width, hidden parts, empty state | FR-12, FR-14, FR-15, FR-17 | T-14 | AC-11, AC-13, AC-14, AC-16 | [x] |
| T-16 | Customise panel: card visibility, width, part toggles, move earlier/later | FR-12..FR-15 | T-15 | AC-11, AC-13, AC-14 | [x] |
| T-17 | Drag-and-drop reordering with dnd-kit (pointer, touch, keyboard) | FR-13 | T-16 | AC-12 | [x] |
| T-18 | Persistence UX: reset, export, import with validation and clear errors, corrupt-storage fallback | FR-16 | T-14, T-16 | AC-15 | [x] |
| T-19 | Docs (README, user guide for customising, ADR 0009), bundle-size measurement, deploy the UI to the Mac mini | all | T-12..T-18 | AC-17, manual check on the mini | [x] |
| T-20 | Allow width 3: catalogue, validator, span classes, panel width control; 1.1.0 files still import | FR-14 | T-14 | AC-13 | [x] |
| T-21 | Responsive grid (1/2/4 columns by viewport) and container-aware cards: `@container` on Card and container variants inside every card; guard test | FR-20, FR-21 | T-20 | AC-20, AC-21, owner visual review | [x] |
| T-22 | Selection: click a card to select, selected outline, sidebar detail view with the overview and a way back; select from the overview list | FR-19 | T-21 | AC-19 | [x] |
| T-23 | Drag-to-resize: pure `spanFromPointer`, pointer hook, keyboard slider, live preview, Escape cancels | FR-18 | T-22 | AC-18 | [x] |
| T-24 | Docs (customising guide, ADR 0010), update illustration if needed, measure bundle, deploy the UI to the Mac mini | all | T-20..T-23 | manual check on the mini | [x] |
| T-25 | `agentUrl()`: `wss` over HTTPS, `ws` over HTTP, override respected; use it in the app | FR-22 | T-2 | AC-22 | [x] |
| T-26 | `deploy/tailscale-https.sh` (on, off, status, dry run, refuses Funnel) with stub-based tests | FR-23 | T-25 | AC-23 | [x] |
| T-27 | `deploy/upgrade.sh` (build, copy, install, rebuild UI, checks, URLs) with dry run | FR-24 | T-11 | AC-24 | [x] |
| T-28 | Docs, deploy to the Mac mini through the upgrade script, verify HTTPS live once Serve is enabled | all | T-25..T-27 | AC-23, AC-24 live | [ ] |

## Definition of done (this version)
- [ ] Every functional requirement (FR-N) has at least one task.
- [ ] Every acceptance criterion (AC-N) has a verifying test.
- [ ] All tasks checked off and tests passing.
- [ ] `spec.md` and `plan.md` still match what was built (else bump + reconcile).