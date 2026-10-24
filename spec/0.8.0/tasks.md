---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime host monitor
version: 0.8.0
status: draft
updated: 2026-10-23
---
# minidash realtime host monitor — Task Backlog

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
| T-20 | Allow width 3: catalogue, validator, span classes, panel width control; 0.2.0 files still import | FR-14 | T-14 | AC-13 | [x] |
| T-21 | Responsive grid (1/2/4 columns by viewport) and container-aware cards: `@container` on Card and container variants inside every card; guard test | FR-20, FR-21 | T-20 | AC-20, AC-21, owner visual review | [x] |
| T-22 | Selection: click a card to select, selected outline, sidebar detail view with the overview and a way back; select from the overview list | FR-19 | T-21 | AC-19 | [x] |
| T-23 | Drag-to-resize: pure `spanFromPointer`, pointer hook, keyboard slider, live preview, Escape cancels | FR-18 | T-22 | AC-18 | [x] |
| T-24 | Docs (customising guide, ADR 0010), update illustration if needed, measure bundle, deploy the UI to the Mac mini | all | T-20..T-23 | manual check on the mini | [x] |
| T-25 | `agentUrl()`: `wss` over HTTPS, `ws` over HTTP, override respected; use it in the app | FR-22 | T-2 | AC-22 | [x] |
| T-26 | `deploy/tailscale-https.sh` (on, off, status, dry run, refuses Funnel) with stub-based tests | FR-23 | T-25 | AC-23 | [x] |
| T-27 | `deploy/upgrade.sh` (build, copy, install, rebuild UI, checks, URLs) with dry run | FR-24 | T-11 | AC-24 | [x] |
| T-28 | Docs, deploy to the Mac mini through the upgrade script; the live HTTPS check is a manual check that needs Serve enabled (accepted gap, spec section 9) | all | T-25..T-27 | AC-23, AC-24 live | [x] |
| T-29 | `honeycomb(n)`: row lengths, cell centres and size for any core count; unit tests for 1 to 128 | FR-26 | T-3 | AC-26 | [x] |
| T-30 | `CoresReactor`: hexagon cells with fill, tier colour, percentage, core number, accessible names; component tests | FR-25, FR-27 | T-29 | AC-25, AC-27 | [x] |
| T-31 | Use it in the CPU card (replace the bars), fill spare height, keep the `cores` detail id; update the catalogue label and tests | FR-25, FR-26 | T-30 | AC-25, AC-26 | [x] |
| T-32 | Docs, README illustration, deploy to the Mac mini through the upgrade script | all | T-31 | manual visual review (accepted gap, spec section 9) | [x] |
| T-33 | Contract: add optional `gpu` (number 0–100 or null) to process items and optional `gpuError` to `processesData` in `contracts/snapshot.schema.json`, update the list description, regenerate web types (`npm run gen:types`) | FR-29, FR-31 | — | AC-34: agent schema tests (0.5.x payload without `gpu` validates; numbers, nulls and `gpuError` validate; −1 and 101 rejected); `tsc -b` | [x] |
| T-34 | `agent/internal/collect/gputime`: `Reader` interface and fake; real reader forking `ioreg -r -c AGXDeviceUserClient -l -a` with a 1 s timeout and a 4 MiB cap; plist decode of the two keys; strict creator parse; per-pid sums; client cap and overflow check. Recorded fixtures from the mini, sanitised per plan §3, plus synthetic edge cases and a fuzz test. ADR 0015 (reading GPU time by forking `ioreg`, with the rejected alternatives) in the same change | FR-29, FR-31 | T-33 | AC-29 (summing), AC-31 (reader errors): Go unit tests on fixtures; fixture sanitising reviewed in the PR | [x] |
| T-35 | Pure `rates(prev, cur, dt)`: first sample, new pid, drop resets the baseline, no clients reads 0, clamp to 0–100; table tests | FR-29 | T-34 | AC-29: Go table tests | [x] |
| T-36 | Processes collector integration: take a `gputime.Reader`; read alongside `List`; `Proc.GPU *float64`, `Data.GPUError`; third ranking (top 25 by GPU above 0) in `topUnion`; keep the baseline on error; GPU interval (multiples of 3 s, `0` = off) from `MINIDASH_PROC_GPU_INTERVAL_MS` in `internal/config`, validated at startup; wire it in `main.go` | FR-29, FR-30, FR-31 | T-35 | AC-29, AC-30, AC-31 (agent half), AC-34 (emitted snapshot passes `AssertMatchesContract`): unit tests with fakes and a fake clock; config tests | [x] |
| T-37 | Measure the CPU cost on the Mac mini: agent plus `macmon` over 60 s with one client connected, with GPU off (`0`) and at 3, 6 and 9 s. Set the default interval by plan DD-24 and record the figures in `docs/collectors.md` (CPU budget). If no interval fits, stop and go back to the owner (spec §9) | NFR budget | T-36 | AC-35: manual measurement on real hardware (needs the mini, not the owner's eye) | [x] Measured 2026-10-18: 1.47% off, 1.64-1.70% at 3 s; default 3000 (docs/collectors.md). The repeat run was stopped early at the owner's request. |
| T-38 | Web GPU column: `gpu` column in `ProcessesCard` (between CPU and Memory, `@2xs` variant, "–" for null or missing), nulls-last comparator in `web/src/lib` with unit tests, "GPU unavailable: <reason>" line, `gpu` part in the catalogue, `note` text and label become the attribution note; card, responsive, layout-model and Customise tests | FR-32, FR-33, FR-31 | T-33, T-37 | AC-31 (web half), AC-32, AC-33 (card half): Vitest; owner's eye for AC-32's visual clause | [x] |
| T-39 | Docs for per-process GPU: `docs/collectors.md` (processes: GPU source, units, interval, attribution, failure modes, sanitised fixtures; replace the "no GPU column yet" note), `docs/troubleshooting.md` (GPU column shows "–", system services carrying GPU time; replace the "not built yet" entry), README known limits and status, `docs/configuration.md` (`MINIDASH_PROC_GPU_INTERVAL_MS`), `docs/architecture.md` if the collector diagram names inputs, `docs/deploy.md` manual checks for AC-26 visual, AC-28, AC-29 live, AC-32 and AC-35 | FR-33, all | T-37, T-38 | AC-33 (docs half): review against the spec; links resolve | [x] |
| T-40 | CPU card layout: core count in the `Card` header, load average as the total's label, chart and honeycomb in one container (`flex-col`, `@md:flex-row`, honeycomb column `@md:w-2/5` stretching to the row), full width when the other part is hidden; update CPU card, responsive and Dashboard tests | FR-28, FR-26 | — | AC-28 (structure), AC-26 (amended): Vitest; owner's eye for AC-28's visual clause | [x] |
| T-41 | Illustrations and deploy: check `docs/images/overview.svg` still matches (it already shows the side-by-side CPU card with "10 cores" in the header, and has no process table, so no GPU column is needed); fix `docs/images/customise.svg`'s stale "Per-core bars" label to "Per-core reactor"; update `docs/customising.md` for the new `gpu` detail; deploy agent and UI to the mini with `deploy/upgrade.sh` and run the live checks | FR-28, FR-32, all | T-39, T-40 | `deploy/upgrade.sh` checks pass; owner's eye: AC-26 visual, AC-28 visual, AC-29 live, AC-32 visual (accepted gaps at release if no result is recorded) | [x] Illustrations in #25, the gpu detail doc in release/0.6.0, deployed with deploy/upgrade.sh after release. |

### Acceptance criteria that need the owner's eye (0.6.0)
- **AC-28, visual clause:** the CPU card side by side at width 2, stacked at width 1 and on a phone, with nothing squashed (after T-41).
- **AC-29, live clause:** a Metal workload's GPU % on the mini tracks the workload and is in the same range as Activity Monitor's "% GPU" (after T-41).
- **AC-32, visual clause:** the GPU column is readable at one-column and full card width (after T-41).
- **AC-26, visual clause** (carried from 0.5.0): the reactor at several widths and heights.

AC-35 needs the Mac mini but not the owner: it is a measurement (T-37). Every other new criterion is covered by automated tests.

**Order and dependencies.** T-33 to T-39 are the GPU column, in the order contract → reader → rates → collector → budget → UI → docs. T-37 is a gate: the UI is not built until the cost is known to fit. T-40 (layout) depends on nothing in the GPU work and is listed after it, as the owner ordered. It can be done in parallel on its own branch. T-41 comes last.

## Definition of done (this version)
- [x] Spec §9's open question (the GPU interval) is answered and the spec approved before T-33 starts.
- [x] Every functional requirement (FR-N) has at least one task.
- [x] Every acceptance criterion (AC-N) has a verifying test. (owner-only clauses are accepted gaps in spec §9)
- [x] All tasks checked off and tests passing.
- [x] `spec.md` and `plan.md` still match what was built (else bump + reconcile).

## 0.7.0 backlog — log retention

> Blocked until spec §9's `[NEEDS INPUT]` questions (default window, bucket boundaries/aggregation,
> history directory, which collectors are stored) are resolved and the spec is approved.

| # | Task | Serves | Depends on | Verify by | Done |
| --- | --- | --- | --- | --- | --- |
| T-42 | Resolve spec §9 open questions with the owner; approve 0.7.0 | FR-34..FR-39 | — | spec status `approved` | [x] |
| T-43 | Add `MINIDASH_RETENTION` parsing to config with validation and default | FR-34, FR-35 | T-42 | AC-36 | [x] |
| T-44 | Design the bucket scheme (boundaries + aggregation) and record it in plan §3 | FR-36 | T-42 | review | [x] |
| T-45 | Implement the history store: append raw ticks, coalesce to buckets, prune to window | FR-34, FR-36 | T-43, T-44 | AC-37 | [x] |
| T-46 | Add authenticated `GET /history` endpoint returning downsampled points | FR-37 | T-45 | AC-38 | [x] |
| T-47 | Web UI: time-range picker clamped to the agent's window; charts render the range | FR-38 | T-46 | AC-39 (web tests) | [x] |
| T-48 | Docs: configuration, stream-protocol, collectors; README retention note | FR-34..FR-38 | T-47 | review | [x] |
| T-49 | Measure agent CPU/memory with retention on; record in collectors.md | NFR budget | T-45 | AC-35-style measurement | [x] |
## 0.8.0 backlog — multi-host

> Spec approved 2026-10-25 (T-50). Order: contract → Linux
> agent → hub → web → deploy → measure. The Linux agent (T-52 to T-57) is useful on its own: the LLM
> box can run a single-host dashboard before the hub exists.

| # | Task | Serves | Depends on | Verify by | Done |
| --- | --- | --- | --- | --- | --- |
| T-50 | Resolve spec §9 Q1 to Q7 with the owner; amend spec and plan; approve 0.8.0; ADR 0017 (multi-host hub) | all | — | spec status `approved` | [x] |
| T-51 | Contract: `host`, `unsupported`, Linux memory fields (relax the macOS ones), `gpus`, `thermal` in `snapshot.schema.json`; new `stream.schema.json` for `auth` and `hosts`; regenerate web types; schema tests | FR-40, FR-43, FR-44, FR-46, FR-49 | T-50 | AC-59 | [ ] |
| T-52 | `internal/hostinfo` and `MINIDASH_HOST_ID`/`MINIDASH_HOST_NAME` config; `host` in every snapshot | FR-40 | T-51 | AC-40 | [ ] |
| T-53 | Linux builds in CI (`linux/amd64`, `linux/arm64`, tests on `ubuntu-latest`) and in the release workflow; record and sanitise Linux fixtures on the LLM box | FR-41 | T-51 | AC-41 | [ ] |
| T-54 | Linux memory, disks, network, containers sockets, shares; `soc` unsupported on Linux; processes GPU no-op on Linux | FR-42, FR-43, FR-45 | T-53 | AC-42, AC-43 (agent half), AC-45 (agent half) | [ ] |
| T-55 | `collect/gpus`: `nvidia-smi` runner, parser, fuzz test, fixtures | FR-44 | T-53 | AC-44 | [ ] |
| T-56 | `collect/thermal`: hwmon reader on a fixture tree | FR-46 | T-53 | AC-46 | [ ] |
| T-57 | Web: `unsupported` notice, Linux memory breakdown, `gpus` panel and `vram` part, Linux temps and fans in the GPU card | FR-43, FR-55, FR-56 | T-51 | AC-43 (web half), AC-45 (web half), AC-55 | [ ] |
| T-58 | `install-agent.sh` on Linux (systemd user unit, lingering check, dry run); install on the LLM box | FR-58 | T-54..T-56 | AC-57 (installer), live install | [ ] |
| T-59 | `internal/hostsfile`: load and validate, permission check, token-free errors | FR-47 | T-52 | AC-47 | [ ] |
| T-60 | `internal/upstream`: client per remote, states, backoff, size cap, typed decode, relabel, no writes | FR-48, FR-51, FR-52 | T-59 | AC-48, AC-51, AC-52 | [ ] |
| T-61 | Hub subscriptions (`hosts: "all"`), per-host fan-out, `hosts` message; 0.7.0 client path unchanged | FR-49 | T-60 | AC-49 | [ ] |
| T-62 | History per host, `/history?host=`, move the 0.7.0 file into the own host's directory | FR-50 | T-61 | AC-50 | [ ] |
| T-63 | Web: per-host state in the connection hook, `useHost`, `HostPicker`, `?host=`, down/stale banner, range picker passes `host` | FR-53, FR-57 | T-61, T-62 | AC-53, AC-56 | [ ] |
| T-64 | Web: Fleet card (catalogue, registry, tiles, parts, default visibility rule) | FR-54 | T-63 | AC-54 | [ ] |
| T-65 | `upgrade.sh` with several targets and per-OS builds | FR-59 | T-58 | AC-57 (upgrade) | [ ] |
| T-66 | Docs: README, architecture (hub diagram), collectors (Linux sources, `gpus`, `thermal`), configuration (`MINIDASH_HOST_*`, `MINIDASH_HOSTS_FILE`), stream protocol (`hosts`), deploy (Linux and adding a host), security (hosts file, remote transport), troubleshooting; `deploy/hosts.example.json` | all | T-64, T-65 | review; links resolve | [ ] |
| T-67 | Deploy: LLM box as remote, Mac mini as hub, UI; measure the budget (AC-58); live checks AC-44, AC-54, AC-57 | NFR budget, all | T-66 | AC-58; owner's eye for AC-54 | [ ] |

### Acceptance criteria that need real hardware or the owner's eye (0.8.0)
- **AC-44, live clause:** model load and a prompt on the LLM box move VRAM, utilisation and power (T-67).
- **AC-54, visual clause:** the Fleet card on the wall display (T-67).
- **AC-57, live clause:** the LLM box installed by the script survives a reboot (T-58).
- **AC-58:** the budget measurement on both machines (T-67).
