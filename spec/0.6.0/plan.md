---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 0.6.0
status: implemented
updated: 2026-10-18
---
# minidash realtime Mac mini monitor — Implementation Plan

> **Stage 2 · PLAN** — select the tech and architecture. This is the *how* for the requirements in
> `spec.md` at this same version. Every decision here should trace back to an FR / NFR.
>
> **Don't assume the stack.** Ask the user about existing platform, datastore, framework, and
> constraints before choosing. Mark unknowns as `[NEEDS INPUT: question]`.

## 1. Approach summary
A small native agent on the Mac mini samples system metrics once a second and streams one JSON snapshot per tick over a WebSocket to a single-page web app. The agent also serves that app as static files, so deployment is one binary under launchd. Status: stack approved by owner 2026-10-18; spec approval pending (spec §9). Version 0.3.0 refines it with resizing, selection and container-aware cards. Version 0.2.0 adds a browser-only UX layer (themes, restyle, customisable layout); the agent and the wire contract do not change. Version 0.6.0 changes both sides: the agent adds a per-process GPU % read from the IORegistry (an additive contract change), and the web adds a GPU column and lays out the CPU card side by side on a wide card.

## 2. Technology choices
<!-- Languages, frameworks, services, libraries. State WHY each, and the alternative rejected. -->
| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Agent | Go (single static binary) | Low overhead, trivial launchd deploy, strong cross-process libraries | Node/TypeScript (heavier runtime), Rust (slower to iterate) |
| System metrics | gopsutil (CPU, memory, disk, net, processes) | Mature, no root | Shelling out to `top`/`vm_stat` (fragile) |
| GPU, power, temps | `macmon` (Rust, sudoless Apple Silicon sampler) behind an interface | Reads GPU/ANE/power without root | `powermetrics` (needs root), IOKit via cgo (more code) |
| Containers | Docker Engine API over each runtime's unix socket (Docker, Podman, Colima expose compatible sockets) | One client for all three | Per-runtime CLIs |
| Shares | `mount` + `smbutil statshares` parsed behind an interface | Built into macOS | None needed |
| Transport | WebSocket, one snapshot per tick | Simple, bidirectional-ready | SSE (one-way, also viable) |
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui | Best ecosystem for a polished dashboard | SvelteKit (smaller, fewer components) |
| Charts | uPlot (time series) + custom SVG gauges | Handles 1 Hz streaming smoothly | ECharts (heavier), Recharts (slow at high rate) |
| Tests | Go `testing`, Vitest, Playwright for UI | One tool per layer | |

**Added in 0.2.0 (web only):**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Pointer, touch and keyboard sensors with screen-reader announcements built in; headless, so it styles with Tailwind. Serves FR-13 and the accessibility NFR. | Native HTML5 drag and drop (no touch, weak keyboard support); hand-rolled pointer logic (re-implements what dnd-kit already tests) |
| Layout state | A pure reducer plus a `useLayout` hook over `localStorage` | Small, fully unit-testable, no store dependency. Serves FR-12 to FR-16. | Zustand or Redux (a dependency for one small state tree) |
| Theme | `data-theme` attribute on `<html>`, CSS variables, and a tiny same-origin `theme-init.js` loaded in `<head>` | Applies before first paint without an inline script, which the container's CSP (`script-src 'self'`) would block. Serves FR-10. | Inline script (blocked by CSP); theme in React state only (flash of the wrong theme) |
| Layout validation | A small handwritten validator | One small type with exact, documented repair rules (spec §7). | `ajv` or `zod` (a dependency for one type) |
| Tests | Existing Vitest + Testing Library + jsdom, plus a contrast test over the design tokens | Same tools as 0.1.0. dnd-kit's keyboard sensor can be driven from tests. | Playwright (needs a real browser; the owner reviews visuals) |

**Added in 0.3.0 (web only, no new dependencies):**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Card-aware layout | Tailwind v4 built-in container queries (`@container`, `@xs:` to `@4xl:` variants) | A card responds to its own width, which is what a 1-column and a full-width card need, with no JavaScript and no plugin. Serves FR-20. | A `ResizeObserver` hook setting a size class (testable in jsdom, but re-renders on every resize and duplicates what CSS does natively); viewport breakpoints (wrong unit: the same viewport hosts cards of every width) |
| Resize drag | Small pointer-events hook with pointer capture, plus a pure `spanFromPointer` function | Snapping to columns is simple arithmetic; a pure function is unit-testable without a layout engine. Serves FR-18. | dnd-kit (built for moving and sorting, not edge resizing); a resize library (a dependency for 20 lines of arithmetic) |
| Selection | A `selectedId` in app state, shared by the grid and the sidebar | One source of truth; selecting never touches the layout. Serves FR-19. | Storing selection in the layout (it is transient UI state and must not persist) |
| Viewport grid | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` with span classes per column count | Serves FR-21. | A custom media-query grid (Tailwind already provides it) |

**Added in 0.4.0:**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| HTTPS | `tailscale serve` (HTTPS 443 to the UI, HTTPS 8787 to the agent) | Tailscale issues and renews certificates for the tailnet name; nothing for us to manage; tailnet-only. Serves FR-23. | A reverse proxy of our own with Let's Encrypt (certificates to renew, port 443 collisions with Traefik); TLS in the agent (key management in the agent); Funnel (public) |
| UI scheme | A pure `agentUrl(location, override)` function | Testable without a browser. Serves FR-22. | Inline logic in App (untested) |
| Scripts | Bash with a `--dry-run` and a stubbable `tailscale`/`ssh` | Matches the existing installer; testable with stubs. Serves FR-23, FR-24. | A Go or Node CLI (a runtime to install for a handful of commands) |

**Added in 0.5.0 (web only, no new dependencies):**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Drawing | Inline SVG, one polygon per cell, scaled by `viewBox` | Scales to any container with no JavaScript measuring, themes through CSS variables, accessible with `<title>` per cell. Serves FR-25 to FR-27. | Canvas (no per-cell text alternative, needs redraw on resize); CSS `clip-path` hexagons (awkward to lay out in a honeycomb) |
| Layout | A pure `honeycomb(n)` function | Testable for every count from 1 to 128 without a browser. Serves FR-26. | Hand-placed layouts per core count (does not cover 8, 10, 12, 14, 16, 24 cores generically) |
| Fill | A clip-path hexagon with a rect scaled in Y | Fill follows the hexagon's shape and animates with a CSS transform transition (disabled under reduced motion). | Redrawing a clipped polygon on every update (no smooth transition) |

**Added in 0.6.0 (no new dependencies):**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Reading GPU clients | Fork `/usr/sbin/ioreg -r -c AGXDeviceUserClient -l -a` on the GPU interval, with a 1 s timeout and a 4 MiB output cap. Decode the plist with `howett.net/plist`, which the disk collector already uses, into a struct holding only `IOUserClientCreator` and `AppUsage[].accumulatedGPUTime`. All behind a `gputime.Reader` interface with a fake. | Works with `CGO_ENABLED=0`. Uses a structured, documented output format, so there is no hand-written grammar to keep up with, and unknown keys are ignored. A crash or hang stays in a child process that the timeout kills, so it cannot take the agent down. The agent already forks `vm_stat`, `diskutil` and `macmon`. Serves FR-29, FR-31. | **`ioreg -l -w0` text with a hand-written parser** (the owner's example): same cost (measured), but an undocumented text grammar with nested `{}`/`()` and quoting to parse, bound and fuzz ourselves. **IOKit in process through `purego`** (already an indirect dependency via gopsutil): no fork, and probably well under 1 ms per read, which would allow 3 s. But it needs CoreFoundation walking (CFDictionary, CFArray, CFNumber, CFString) and manual `CFRelease` through an FFI with no type checking. A wrong signature segfaults the whole agent, which `recover` cannot catch and which breaks DD-1. It is also unverified that user clients can be reached by matching, rather than by walking the accelerator's children. Kept as the fallback if the fork cost cannot fit the budget (DD-24, open question in spec §9). **IOKit through cgo:** the release build is `CGO_ENABLED=0` (`deploy/make-release-assets.sh`, `deploy/upgrade.sh`), and cgo would bring a C toolchain into the build. **`powermetrics`:** needs root. **A separate helper binary:** another install and launchd unit for one read. **Activity Monitor's private frameworks:** private API. |
| GPU rate | A pure function `rates(prev, cur Sample, dt) map[int32]*float64` that applies FR-29's rules | Every rule (first sight, drop, clamp, no clients) is a table test with no clock or host. Serves FR-29. | Computing inside the collector loop (harder to test exhaustively) |
| CPU card layout | One flex container: `flex-col` by default, `@md:flex-row` from a 28 rem card; the core count moves into `Card`'s existing `right` slot | Same container-query mechanism as ADR 0010, no JavaScript measuring, and the header slot already exists. Serves FR-28. | CSS grid with named areas (more classes for the same two cases); a `ResizeObserver` (rejected in ADR 0010) |

## 3. Architecture
collectors (cpu, gpu, mem, disk, net, procs, containers, shares) -> snapshot aggregator (1 Hz) -> WebSocket hub -> browser store -> chart/table components. Each collector sits behind a small interface so it can fail independently and be faked in tests.

**Web layer in 0.2.0.**

- **Card registry** (`web/src/layout/registry.ts`) is the single source of truth: each entry has an `id`, title, component, default span and its hideable parts. Layout validation, the customise panel and the grid all read from it, so adding a card is one entry.
- **Layout module** (`web/src/layout/`): the `Layout` type and defaults, `validate` (repairs and refuses per spec §7), a reducer (`toggleCard`, `move`, `setSpan`, `togglePart`, `reset`, `importLayout`) and `useLayout` (reads and writes `localStorage` inside try/catch, falls back to memory).
- **Dashboard grid** renders `layout.cards` in order, skipping hidden ones, each wrapped in a sortable item whose width class comes from its span. Cards receive a `hidden` set and omit those parts.
- **Customise panel** (a side sheet opened from the header): per-card visibility, width and part toggles, move earlier/later buttons, reset, export, import. Drag handles appear on cards while customising.
- **Theme module**: `ThemeSwitch` writes `minidash.theme` and sets `data-theme`; `theme-init.js` does the same from storage before paint. A small `useThemeVersion` hook re-renders `Chart` when the effective theme changes, so uPlot colours update.
- **Wall mode** is applied after the layout: it filters out `processes` and `shares` for display only and never writes to storage.

**Visual style (FR-11).** The 0.1.0 tokens already match the illustration's palette; 0.2.0 restyles the structure to match it: brand mark and wordmark in the header, status pill, summary strip, card header typography (small caps title, large value), 14 px card radius, gradient area fills under chart lines, tile-style secondary metrics, consistent 16/24 px spacing. Light and dark are two token sets:

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#0b0d11` | `#f4f5f7` |
| `--surface` | `#14171d` | `#ffffff` |
| `--line` | `#232832` | `#e3e6eb` |
| `--fg` | `#e8ebf0` | `#12151a` |
| `--muted` | `#8a93a3` | `#6a7280` |
| `--accent` | `#6c93ff` | `#3b6df5` |

A test computes WCAG contrast for the text pairs in both sets (AC-10); a failing pair fails the build.

**0.3.0 additions.**

- **Container-aware cards.** The shared `Card` is a size container (`@container`). Anything inside that depends on space uses container variants, never viewport ones: tile grids, runtime columns, table columns, bar heights, wrapping headers. Card content width at four columns on a 1280 px screen is roughly 17 rem (1 column), 36 rem (2), 57 rem (3) and 77 rem (4), so the working breakpoints are `@sm` (24 rem), `@xl` (36 rem) and `@3xl` (48 rem). A test fails if a card component uses a viewport breakpoint for its inner layout.
- **Grid.** One column below `md`, two from `md`, four from `lg`. Span classes map width 2 to 4 to the full row at `md`, and width 1 to half.
- **Resize grip.** While Customise is open and the grid has four columns, each card shows a grip on its right edge. `spanFromPointer(x, cardLeft, columnWidth, gap, columns)` turns a pointer position into a snapped width; the hook dispatches `setSpan` only when that value changes, and Escape restores the starting width. The grip is a keyboard-operable `role="slider"` (1 to 4).
- **Selection.** `selectedId` lives in the app. Clicking a card while Customise is open selects it; the overview list can also select, so keyboard users never need the pointer. The sidebar is a detail view for the selected card or the overview list with the file controls.

**HTTPS path (0.4.0).** `tailscale serve` terminates TLS on the Mac mini and forwards to local plain HTTP: `https://<host>.ts.net/` to `127.0.0.1:8080` (the UI container) and `https://<host>.ts.net:8787/` to `127.0.0.1:8787` (the agent). The browser loads the UI over HTTPS and opens `wss://<host>.ts.net:8787/ws`. The agent's `MINIDASH_ORIGINS` gains `<host>.ts.net` so the HTTPS page's Origin is accepted. The LAN HTTP ports are unchanged. `deploy/tailscale-https.sh on|off|status` manages this, and `deploy/upgrade.sh` deploys to the mini.

**Cores reactor (0.5.0).** `honeycomb(n)` returns cell centres and the drawing's size in unit hexagons: it tries equal staggered rows and alternating-length rows, and picks the one whose aspect ratio is closest to a round cluster (target 1.2). `CoresReactor` draws each cell as a hexagon with a base fill, a clipped level rect scaled to the utilisation, the rounded percentage and the core number. The core number is hidden below the `@xs` container width with a container variant. The CPU card becomes a flex column so the reactor takes the spare height (`flex-1`, with a minimum and a maximum height).

**Per-process GPU (0.6.0).**

- **Package `agent/internal/collect/gputime`.**
  - `Reader` interface: `Read(ctx) (Sample, error)`, where `Sample` is `{At time.Time; Busy map[int32]uint64}`, the summed `accumulatedGPUTime` in ns per pid.
  - The real reader runs `ioreg` (§2) under `exec.CommandContext` with a 1 s timeout, reads stdout through an `io.LimitReader` of 4 MiB plus one byte (more than 4 MiB is an error, not a truncated parse), and decodes the plist.
  - `IOUserClientCreator` must match `^pid (\d{1,6}), ` with a pid from 1 to 99999. Other entries are skipped and counted. More than 4096 clients is an error.
  - A sum that would overflow `uint64` is an error.
  - The client's name in the registry is not used; the table keeps gopsutil's name.
  - `At` is taken when `ioreg` returns.
- **Rates.** `rates(prev, cur, dt)` applies FR-29: `null` with no previous sample, for a pid new in `cur` with clients, or when a sum went down. Otherwise Δns / Δt × 100, clamped to 0–100. A pid absent from `cur` (no GPU clients) reads 0. The new baseline is always `cur`, so a drop resets it.
- **Collector integration** (`processes`).
  - `processes.NewWith(os, gpu)` takes a `gputime.Reader`. `Collect` starts the GPU read in a goroutine alongside `List`, so the fork overlaps the process scan instead of adding to it. It joins before ranking.
  - On error, the previous baseline is kept, so the next success measures over the longer interval. Every `gpu` is `null` and `gpuError` is set. The list is built as before (FR-31).
  - `Proc.GPU` is a `*float64` with `json:"gpu"`, so `null` is sent explicitly. `Data.GPUError` is a `string` with `json:"gpuError,omitempty"`.
  - `topUnion` gains a third ranking, the top 25 by GPU with GPU above 0 (FR-30). The worst case adds 25 name and owner lookups. In practice it adds few, because the busy GPU clients are usually already in the CPU or memory lists.
- **Interval** (DD-24). The processes collector stays on its 3 s throttle. The GPU read has its own interval, `MINIDASH_PROC_GPU_INTERVAL_MS`, which must be 0 or a multiple of 3000 so it lines up with process refreshes. Between GPU reads, the last computed per-pid values are reused for pids still present; a pid that appeared since then is `null`. With `0`, the reader is never called: every `gpu` is `null` and `gpuError` is "per-process GPU is turned off (MINIDASH_PROC_GPU_INTERVAL_MS=0)". Invalid values stop the agent at startup, as `MINIDASH_SOC_INTERVAL_MS` does. The default is set by T-37 from the measurement.
- **Fixtures.**
  - Recorded on the Mac mini with `ioreg -r -c AGXDeviceUserClient -l -a`, then sanitised: pids renumbered, app names other than system services (`WindowServer`, `runningboardd`, `kernel_task`) replaced with `ExampleApp`-style names, `IORegistryEntryID` and other ids rewritten, and unused keys trimmed.
  - Synthetic fixtures cover: empty `AppUsage`, several clients per pid, several `AppUsage` entries per client, a malformed creator, a missing `accumulatedGPUTime`, non-plist output, and oversized output.
  - A fuzz test feeds random bytes to the decoder and the creator parser.

**Web GPU column (0.6.0).**

- `ProcessesCard` gains `{ key: 'gpu', label: 'GPU' }` between CPU and Memory, with the header and cells `hidden @2xs:table-cell` and wrapped in the `gpu` part.
- Sorting uses a comparator in which `null` and `undefined` always sort last whatever the direction. It is a pure function in `web/src/lib`, unit-tested.
- Cells render `x.x%` or "–".
- When `gpuError` is present and the column is shown, a muted line "GPU unavailable: <reason>" appears under the table.
- The `note` part's text becomes the attribution note (FR-33). The catalogue gains `{ id: 'gpu', label: 'GPU column' }`, and the `note` label becomes "GPU attribution note".

**CPU card layout (0.6.0).**

- `CpuCard` passes `<span>{n} cores</span>` to `Card`'s `right` slot.
- The `Stat` label becomes the load average line, inside the `load` part.
- The chart and the reactor sit in one container, `flex flex-1 flex-col gap-4 @md:flex-row`.
  - Left column (`min-w-0 flex-1`): the stat and the chart.
  - Right column: the reactor box, `relative min-h-40 @md:w-2/5 @md:min-h-0 @md:self-stretch`, so on a wide card it is as tall as the left column and grows when the card stretches. Stacked, it keeps today's `flex-1` with minimum heights.
  - When one of `chart` or `cores` is hidden, the remaining column has `flex-1` and no width cap.
- Breakpoint numbers, from the page's padding, the 80 rem maximum width and 1 rem gaps, with card content = column span minus 2 rem of padding:
  - Width-2 card on the four-column grid: 28 rem at a 1024 px window, 37.5 rem at full width.
  - Width-1 card: 12.5 to 17.25 rem.
  - Phone, 360 to 430 px: about 18.5 to 23 rem.
  - Half-width card on the two-column grid: 20 to 28 rem.
- `@md` (28 rem) therefore puts every width-2 card on a desktop side by side and stacks every width-1 card and phone. `@xl` (36 rem) was rejected: a width-2 card would only go side by side above about a 1270 px window, so the default layout on most laptops would never match the illustration. With Customise open, the sidebar narrows the cards, and they stack, which is fine.

## 4. Data & contracts
<!-- Concrete realisation of spec.md §7: schemas, API endpoints, message/event shapes, storage. Define typed contracts before coding. -->
```
```

The `Layout` type, the default layout, the part catalogue and the import repair rules are specified in spec §7 and implemented in `web/src/layout/`. Storage keys: `minidash.layout` (JSON `Layout`) and `minidash.theme` (`"system" | "light" | "dark"`). The export file is the `Layout` JSON, downloaded as `minidash-layout.json`. The snapshot contract is unchanged.

`Layout.cards[].span` widens from `1 | 2 | 4` to `1 | 2 | 3 | 4` (spec §7). Layout `version` stays 1: the change is additive, 0.2.0 files import unchanged, and a 0.2.0 build repairs a width of 3 to the card's default. Selection is not part of the layout and is never stored.

**0.6.0 schema change** (`contracts/snapshot.schema.json`, additive, `schema` stays 1). Each item of `processesData.list` gains an optional property, and `processesData` gains one. Neither is added to `required`:

```json
"gpu": {
  "type": ["number", "null"],
  "minimum": 0,
  "maximum": 100,
  "description": "GPU % over the last GPU interval, from IORegistry accumulatedGPUTime deltas. null = not known yet or the GPU source failed. Credited to the process macOS names."
}
"gpuError": {
  "type": "string",
  "description": "Why per-process GPU values are null this round. Present only on failure or when turned off."
}
```

`npm run gen:types` regenerates `web/src/contract/snapshot.ts` (`gpu?: number | null`, `gpuError?: string`). The `processesData` description changes to "list = union of the top 25 by CPU, by memory and by GPU". The agent's schema test (`agent/internal/testutil/schema.go`) validates real collector output against the schema, so a Go struct that drifts from it fails CI. The layout gains the `gpu` part only; layout `version` stays 1.

## 5. Key decisions & trade-offs
<!-- The decisions a future reader would otherwise re-litigate. One line each: decision → rationale. -->
- **DD-1.** Collectors fail independently: one broken source never blanks the dashboard. (FR-6, FR-8)
- **DD-2.** Read-only agent, localhost bind by default. (NFR network exposure)
- **DD-4.** Deployment is container-based, but a container on macOS runs in a Linux VM and cannot see the host's CPU, GPU, memory, disks, shares or `macmon`. So the collecting agent is a small native process under launchd (host access, read-only), and the web UI plus its static server is the container. The container reaches the agent over the LAN with the shared token. Owner asked for "container"; this is the part that cannot be one. (FR-1..FR-9)
- **DD-5.** Access control is a shared token (config, constant-time compare, refuses to start without one), over LAN. (NFR network exposure)
- **DD-3.** Privileged data (e.g. powermetrics) is isolated in a separate optional helper, never in the main agent.
- **DD-6.** Layout and theme are browser state in `localStorage`, exported and imported as JSON. The agent stays read-only and gains no endpoints. A shared, agent-side layout was considered and rejected for 0.2.0 because it would make the agent write state. (Non-goals, NFR privacy)
- **DD-7.** Drag and drop uses dnd-kit for its keyboard and touch support, with explicit move earlier/later buttons as the guaranteed accessible path. (FR-13, accessibility NFR)
- **DD-8.** The theme is a `data-theme` attribute set by a same-origin script before paint, not an inline script, because the container's CSP forbids inline scripts. (FR-10)
- **DD-9.** The card registry is the one place that knows what cards and parts exist; validation and UI derive from it, so a new card appears for existing users automatically. (FR-16)
- **DD-10.** Wall mode is a display-time filter over the layout and never persists. (FR-17)
- **DD-11.** Cards respond to their own width with container queries, not the viewport. The same viewport hosts cards of different widths, so only the container is the right unit. (FR-20)
- **DD-12.** Resizing is width-only and snaps to columns, so cards never clip content and the layout stays a simple grid. Height is content-driven. (Non-goals, FR-18)
- **DD-13.** Selection is transient UI state, not layout. It is never persisted and never changes the layout. (FR-19)
- **DD-14.** Width 3 is added to the allowed widths so dragging can land on any of the four columns; the layout version stays 1 because the change is additive. (FR-14, FR-18)
- **DD-15.** Use Tailscale Serve, not our own TLS. Certificates, renewal and trust are Tailscale's job; the dashboard stays reachable only on the tailnet. (FR-23)
- **DD-16.** Keep plain HTTP on the LAN as a fallback; HTTPS is additive. (NFR)
- **DD-17.** The UI picks `wss` from the page's own scheme, because browsers block `ws://` from an HTTPS page; no configuration needed. (FR-22)
- **DD-18.** Pointy-top hexagons in a honeycomb with the cluster as round as possible, so it reads as a reactor core and uses a card's area well. (FR-25, FR-26)
- **DD-19.** Load shows as fill level and colour tier (normal, warm, hot), not colour alone: the percentage is printed too. (FR-25, accessibility NFR)
- **DD-20.** The detail keeps the id `cores`, so layouts saved by earlier versions still hide or show it. (FR-25)
- **DD-21.** Read GPU clients by forking `ioreg -a` and decoding the plist, not by parsing the text output and not through IOKit in process. It is the only option that is `CGO_ENABLED=0`, crash-isolated, and free of a hand-written grammar. The cost is a fork and a full registry walk per read (DD-24). Recorded in ADR 0015 with the rejected alternatives. (FR-29, NFR budget)
- **DD-22.** GPU % is clamped to 0–100 and sums every client and every `AppUsage` entry per pid, as the owner decided. A drop in the sum resets the pid's baseline and reads `null` for that interval. Tracking each client separately by registry id would lose less when one of several clients closes, but it is more state for a rare case. Revisit only if the live check (AC-29) shows frequent gaps. (FR-29)
- **DD-23.** A GPU failure is a field inside a successful processes result (`gpuError`), not a failed collector, because the process list is still valid. (FR-31)
- **DD-24.** The GPU read runs on its own interval, 0 or a multiple of the 3 s process refresh. The default is the shortest of 3, 6 or 9 s that keeps the measured total under 1.9% of a core on the Mac mini (0.1% margin under the 2% budget). If even 9 s does not fit, the purego reader becomes necessary. That needs the owner's agreement and an amended plan, and the GPU column ships off (`0`) until then. Pending the owner's answer in spec §9. (NFR budget)
- **DD-25.** The CPU card goes side by side at the `@md` container width (28 rem), so every width-2 card on a desktop grid matches the illustration (numbers in §3). (FR-28)
- **DD-26.** The core count moves to the card header and the load average becomes the total's label, matching the illustration and keeping both visible. (FR-28)

## 6. Risks & mitigations
<!-- What could go wrong technically, and the plan if it does. -->
- **Risk:** forking `ioreg` costs too much CPU. Measured on a dev Mac (M4 Pro, macOS 26) over 200 runs: about 18 ms of CPU per read (user plus system), the same with or without `-l` and for plist or text output. Spawning a trivial binary costs about 1.3 ms, so most of the cost is `ioreg` walking the whole registry. Every 3 s that is about 0.6% of a core, against a measured total of 1.4% to 1.65% today (ADR 0006, `docs/collectors.md`). **Mitigation:** measure on the Mac mini before building the UI (T-37). Set the interval by DD-24. The overlap with the process scan hides the latency but not the CPU. `0` turns it off. The purego reader is the documented fallback.
- **Risk:** attribution. GPU work is credited to whichever process opened the client, and `runningboardd`, `WindowServer` and similar services open clients for apps. An app can then look idle while a system service looks busy. **Mitigation:** report what macOS reports, as the owner decided, and say so in the card note and the docs (FR-33). No re-attribution heuristics.
- **Risk:** the registry format changes across macOS versions: the class name `AGXDeviceUserClient`, the keys `IOUserClientCreator`, `AppUsage` and `accumulatedGPUTime`, or the creator string `pid N, name`. **Mitigation:** decode only the keys we need and ignore the rest. Validate the creator with a strict pattern and skip and count entries that do not match. If nothing matches while clients exist, set a `gpuError` that names the macOS version, so the table keeps working and the failure is visible. Fixtures pin today's format, and a new fixture is recorded when macOS changes it.
- **Risk:** overlapping GPU work across a process's clients sums to more than the wall time. **Mitigation:** clamp to 100 (DD-22). The live check compares with Activity Monitor.
- **Risk:** a pid is reused or a client closes between reads. **Mitigation:** a lower sum resets the baseline and reads `null` (FR-29). Reuse within one 3–9 s interval with a higher sum is possible but unlikely, and it shows as one wrong sample.
- **Risk:** a slow or hung `ioreg` holds up the process list. **Mitigation:** a 1 s timeout kills it, it runs alongside the process scan, and a failure only nulls the GPU values (FR-31, AC-31).
- **Risk:** fixtures leak details of the real machine. **Mitigation:** the sanitising steps in §3 are applied and reviewed before commit (security rules).
- **Risk:** `macmon` output format changes. **Mitigation:** parse behind an interface with a recorded-fixture test.
- **Risk:** dnd-kit's classic packages are not yet released for React 19 peer ranges. **Mitigation:** verify install and the keyboard test early (T-17); the move buttons keep reordering usable if drag misbehaves.
- **Risk:** `localStorage` blocked or full. **Mitigation:** every access in try/catch with in-memory fallback; AC-17 covers it.
- **Risk:** uPlot colours do not follow a manual theme switch (they read CSS variables at creation). **Mitigation:** rebuild the chart when the effective theme changes (T-12).
- **Risk:** a layout saved by an older version meets a newer card set. **Mitigation:** registry-driven repair appends missing cards (AC-15).
- **Risk:** bundle growth from new dependencies. **Mitigation:** one new dependency family; budget of 40 kB gzipped, measured (AC-17).
- **Risk:** container queries cannot be exercised in jsdom. **Mitigation:** component tests assert the structure that makes them work (every card is a container; no inner viewport breakpoints), pure functions carry the logic, and the owner reviews the result at one and full width.
- **Risk:** pointer resizing is hard to automate. **Mitigation:** the snapping maths is a pure, unit-tested function; the hook is driven with synthetic pointer events in tests; keyboard resizing gives a fully testable equivalent.
- **Risk:** a width change reflows the grid and can redraw charts repeatedly. **Mitigation:** dispatch only when the snapped width changes.
- **Risk:** Serve or HTTPS certificates are not enabled on the tailnet (an account setting). **Mitigation:** the script detects this and prints the link to enable it, leaving everything unchanged.
- **Risk:** the agent rejects the HTTPS page's origin. **Mitigation:** the script adds the tailnet host to `MINIDASH_ORIGINS` and restarts the agent; a test covers it.
- **Risk:** the upgrade script reports success while something is broken. **Mitigation:** it checks the agent, the UI and the stream before reporting, and exits non-zero otherwise.
- **Risk:** the reactor looks wrong at some size or core count, which only a browser shows. **Mitigation:** the layout maths is unit-tested for 1 to 128 cores, the SVG is rasterised and inspected during development, and the owner reviews it live.
- **Risk:** a transform transition on SVG elements behaves differently across browsers. **Mitigation:** it uses `transform-box: fill-box`, which current Chrome, Safari and Firefox support; the fill is correct without the transition.
- **Risk:** the side-by-side CPU card squashes the chart or the honeycomb near the breakpoint. **Mitigation:** the honeycomb column is capped at 40% of the card, and the chart column has `min-w-0`. The breakpoint numbers are in §3. The owner reviews widths 1 and 2 and a phone (AC-28).
- **Risk:** jsdom cannot evaluate container queries, so the side-by-side switch is not visible in tests. **Mitigation:** as in 0.3.0, tests assert the classes that make it work, and the owner reviews the result.

## 7. Rollout & observability
<!-- How it ships, how it's measured, how it's rolled back. Maps to NFRs. -->
-

0.2.0 changes only the web container. Build and redeploy it (`docker compose -f deploy/compose.yaml up -d --build`); the agent is untouched. Rollback is the previous image. Stored layouts carry `version: 1`, so a future incompatible change can detect and migrate them. Document the customisation features in the README and `docs/` as part of T-19.

0.6.0 changes the agent and the web container. Deploy both with `deploy/upgrade.sh`. Old and new halves work together: a 0.5.x UI ignores the new fields, and a 0.6.0 UI shows "–" against a 0.5.x agent. Rollback is the previous release's agent binary and image. If per-process GPU misbehaves in the field, set `MINIDASH_PROC_GPU_INTERVAL_MS=0` and restart the agent; nothing else is affected. Observability is the `gpuError` field in the snapshot, shown in the card.