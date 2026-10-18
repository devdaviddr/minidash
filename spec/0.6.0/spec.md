---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 0.6.0
status: draft
owner: devdaviddr
created: 2026-10-18
updated: 2026-10-18
---
# minidash realtime Mac mini monitor — Specification

> **Stage 1 · SPECIFY** — capture the problem and scope. This file is the source of truth for
> *what* and *why*. The *how* lives in `plan.md`; the *do* lives in `tasks.md`.
>
> **Don't guess.** Ask the user for anything you can't state confidently. If a value is still
> unknown, write `[NEEDS INPUT: question]` here and add it to §9 Open questions — never invent it.

## 1. Problem & context
The owner runs an M4 Mac mini as a homelab host (Docker-compatible runtimes, network shares, external storage, media serving). macOS Activity Monitor and CLI tools give point-in-time views and nothing shows CPU, GPU, unified memory, disks, network, containers and shares together, live, in one good-looking place.

minidash is a single dashboard that shows the machine's health in realtime.

Version 0.2.0 adds a UX layer. The first build shows every card in one fixed order, follows the operating system's colour scheme with no way to override it, and looks plainer than the project's own README illustration. People use the dashboard in different places (a wall display, a second monitor, a phone) and care about different data there, so the page should look polished, let the viewer pick a theme, and let them choose which cards and details appear, in what order and how large.

Version 0.3.0 refines the customisable layout. Changing a card's width currently means opening a list and picking a number, only 1, 2 or 4 columns are offered, the sidebar shows every card at once, and the inside of a card is laid out for the whole screen rather than for the space the card actually has, so a one-column card and a full-width card can look cramped or empty. The viewer should be able to select a card and see it in the sidebar, drag its edge to resize it, and trust that every card, and what is inside it, adapts to the width it is given and to the size of the screen.

Version 0.4.0 closes the biggest documented weakness. The dashboard speaks plain HTTP and `ws://` on the network, so the access token and all metrics cross it unencrypted. The Mac mini is already on a Tailscale tailnet, which can terminate HTTPS for tailnet devices with certificates it manages itself. The dashboard should be reachable that way, and a page served over HTTPS must still be able to open its stream (browsers refuse a plain `ws://` connection from an HTTPS page). Upgrading the mini is also a dozen manual steps that should be one command.

Version 0.5.0 improves how the CPU card shows individual cores. In use, the per-core bars sit left-aligned in a row, leave much of the card empty when it is stretched to match a taller neighbour, and make it hard to see at a glance which cores are busy. A compact honeycomb of hexagons, in the style of a reactor core, shows every core at once, fills the space it is given, and makes load visible by fill level and colour.

Version 0.6.0 does two things. First, the CPU card is laid out like the README illustration (`docs/images/overview.svg`): on a wide card the history chart and the honeycomb sit side by side, with the core count in the card header, instead of the honeycomb taking the height below the chart. On a narrow card the honeycomb still stacks under the chart. Second, the process table gains a GPU column. ADR 0014 found that macOS exposes a cumulative GPU time counter for every GPU client to a normal user, in the IORegistry, so per-process GPU use can be shown without root. (The fill-clipping bug in the honeycomb, where a cell's fill leaked outside its hexagon, is fixed separately in hotfix 0.5.2 and is not part of this spec.)

## 2. Goals
<!-- Success as outcomes. -->
- See CPU, GPU, unified memory, disk and network activity update live (about once a second).
- See which processes are using those resources.
- See container usage across Docker, Podman and Colima in one view.
- See mounted shares, network accounts and external drives and their health.
- A modern, polished UI that is pleasant to leave open on a wall display or second monitor.
- A visual style consistent with the README illustration, polished in both light and dark.
- A visible theme switch (System, Light, Dark) that is remembered.
- A customisable layout: choose which cards show, reorder them, resize them, and hide optional details inside cards.
- The layout is remembered per browser and can be reset, exported and imported.
- Cards and everything inside them adapt to the space they are given, whether they are one column or full width, on a phone, tablet or wall display.
- Resize a card by dragging its edge, with the width snapping to whole columns.
- Click a card to select it and see its settings in the sidebar.
- Reach the dashboard over HTTPS from any device on the tailnet, with no certificates to manage.
- Keep plain HTTP on the LAN working as before.
- Upgrade the Mac mini with one command.
- See every CPU core's load at a glance, in a compact and distinctive form.
- Use the space the CPU card has, instead of leaving it empty.
- See the CPU history and the cores side by side on a wide card, as in the README illustration, without either being squashed on a narrow one.
- See which processes are using the GPU, without running anything as root.

## 3. Non-goals
<!-- Out of scope for this version. -->
- Long-term metric storage and alerting (live view only until a later version).
- Monitoring machines other than the Mac mini.
- Controlling the machine or containers (read-only dashboard).
- Syncing layouts between devices through the agent (the agent stays read-only; use export and import).
- Several named layouts or presets (one layout per browser).
- User-defined colours or custom themes.
- Free-form pixel positioning. Cards flow in a grid; the viewer chooses order and width.
- Resizing card height. Height stays content-driven so a card never clips data.
- Resizing by corner or free-form dimensions.
- Exposing the dashboard to the public internet (Tailscale Funnel is never used).
- TLS inside the agent, custom certificates, or a reverse proxy of our own.
- Removing the plain HTTP access on the LAN.
- Showing which cores are efficiency or performance cores (the data does not carry it yet).
- Per-core history or per-core charts.
- Animation beyond a short smooth transition of the fill.
- The honeycomb fill-clipping fix (hotfix 0.5.2, outside this spec).
- Per-process GPU memory, per-process power, or GPU use per API (Metal, OpenCL and so on). Only GPU time is shown.
- Re-attributing GPU time that a system service carries on an app's behalf. Time is credited to the process macOS names.
- Root, `powermetrics` or the privileged helper for per-process GPU data.
- A GPU history per process.

## 4. User scenarios
<!-- "As a <role>, I want <capability> so that <outcome>." -->
- As the homelab owner, I want live CPU/GPU/memory graphs, so that I can see load as it happens.
- As the homelab owner, I want a process list sorted by CPU, GPU or memory, so that I can find what is using resources.
- As the homelab owner, I want one view of Docker, Podman and Colima containers, so that I do not check three CLIs.
- As the homelab owner, I want to see mounted shares and the external drive, so that I notice when one disappears or fills up.
- As the homelab owner, I want to show only CPU, GPU and Network, large, on a wall display, so that the screen is readable from across the room.
- As the homelab owner, I want to hide cards and details I do not care about on my phone, so that the page is short.
- As the homelab owner, I want to pick light or dark regardless of my operating system, so that the dashboard suits the room.
- As the homelab owner, I want to move my layout to another browser, so that I set it up once.
- As the homelab owner, I want to drag a card's edge to make it wider or narrower, so that I can size the page by eye.
- As the homelab owner, I want to click a card and see just its settings in the sidebar, so that I do not hunt through a long list.
- As the homelab owner, I want a narrow card to rearrange its contents instead of overflowing, so that it stays readable at one column.
- As the homelab owner, I want the page to reflow sensibly on my phone and tablet, so that I can check the Mac mini from anywhere.
- As the homelab owner, I want to open the dashboard over HTTPS on my tailnet, so that the token and metrics are encrypted.
- As the homelab owner, I want one command to enable or disable that, so that it is easy to try and to undo.
- As the homelab owner, I want one command to upgrade the Mac mini, so that deploying is not a checklist.
- As the homelab owner, I want to see all CPU cores as a cluster of hexagons whose fill rises with load, so that I can spot a busy core instantly.
- As the homelab owner, I want the core view to fill the CPU card whatever size it is, so that no space is wasted.
- As the homelab owner, I want the CPU chart and the cores side by side on a wide card, so that I see the trend and the per-core load at once, as in the README picture.
- As the homelab owner, I want to sort the process table by GPU, so that I can find what is keeping the GPU busy.

## 5. Functional requirements
<!-- Numbered, testable, implementation-agnostic. FR-N is a contract line referenced by tasks, tests, and version bumps. -->
- **FR-1.** The system MUST show per-core and total CPU utilisation, updating at least once per second.
- **FR-2.** The system MUST show GPU utilisation and unified memory usage (used, wired, compressed, swap) for Apple Silicon.
- **FR-3.** The system MUST show internal and external disk capacity, usage and read/write throughput.
- **FR-4.** The system MUST show per-interface network throughput and the active interfaces.
- **FR-5.** The system MUST list processes with CPU, memory and (where the OS exposes it) GPU use, sortable.
- **FR-6.** The system MUST show running containers and their CPU/memory/network use for each detected runtime (Docker, Podman, Colima), and degrade cleanly when a runtime is absent or stopped.
- **FR-7.** The system MUST list mounted network shares (SMB and NFS) and network accounts, meaning both the users connected to this Mac's file sharing and the accounts used by shares this Mac has mounted. AFP is out of scope.
- **FR-8.** The system MUST push updates to the browser without page reloads and show a clear "disconnected" state if the feed stops.
- **FR-9.** The system SHOULD show temperatures, fan speed and power draw where available without root.
- **FR-10.** The UI MUST provide a visible theme control with System, Light and Dark. The default is System. The choice is remembered per browser, applied before the first paint (no flash of the wrong theme), and charts re-theme immediately.
- **FR-11.** The UI MUST follow the visual style of the README illustration (card surfaces, radii, type scale, status pill, summary strip, brand mark, gradient chart fills) in both themes, and text and key UI colours MUST meet WCAG AA contrast (4.5:1) on their surfaces.
- **FR-12.** The viewer MUST be able to show or hide each card and the summary strip. If everything is hidden the page shows an empty state that explains how to restore it.
- **FR-13.** The viewer MUST be able to reorder cards by drag and drop (mouse and touch) and by a keyboard alternative (move earlier, move later).
- **FR-14.** The viewer MUST be able to set each card's width to 1, 2, 3 or 4 grid columns (0.2.0 offered 1, 2 and 4). Widths apply where the grid has four columns; on narrower screens cards follow FR-21.
- **FR-15.** The viewer MUST be able to hide optional parts inside a card (the catalogue is in §7). Hidden parts are not rendered; the rest of the card is unaffected.
- **FR-16.** The layout MUST be saved per browser automatically and restored on load. The viewer MUST be able to reset to the default layout, export the layout to a JSON file, and import one. Import MUST validate the file, refuse invalid files with a clear message and leave the current layout unchanged. Corrupt stored data MUST fall back to the default layout without breaking the page. Cards added by future versions MUST appear automatically.
- **FR-17.** The existing wall-display mode (`?wall`) MUST keep working on top of the layout (it hides the process table and shares card) without overwriting the saved layout.
- **FR-18.** While Customise is open, the viewer MUST be able to resize a card by dragging its right edge. The width snaps to 1, 2, 3 or 4 columns, previews live while dragging, can be cancelled with Escape (restoring the width from before the drag), and persists. The resize control is also operable by keyboard (arrow keys change the width by one column) and is exposed to assistive technology with its current value. Resizing is offered only where the grid has four columns.
- **FR-19.** While Customise is open, clicking a card MUST select it: the card shows a visible selected state and the sidebar shows that card's settings only (visibility, width, details, move earlier/later) with a way back to the overview of all cards. Selecting another card switches; pressing Escape or choosing the way back deselects. With nothing selected the sidebar shows the overview list and the save, export and import controls. Cards can also be selected from the overview list so selection never needs a pointer. Selecting never changes the layout. Outside Customise, clicking a card does nothing special.
- **FR-20.** Every card, and every element inside it, MUST adapt to the width the card actually has, not only to the screen width: layouts inside a card (tile grids, runtime columns, table columns, chart and bar sizes, wrapped headings) rearrange or simplify at narrow widths and use extra space at wide widths. No card may overflow horizontally at any width from 16 rem to the full grid width.
- **FR-21.** The card grid MUST be one column below 768 px, two columns from 768 px to 1023 px and four columns from 1024 px. In the two-column grid a card of width 2, 3 or 4 spans the full row and a card of width 1 takes half.
- **FR-25.** The CPU card MUST show per-core utilisation as a honeycomb of hexagonal cells, one per logical core, replacing the bar grid. Each cell shows its utilisation as a rounded percentage and has a fill that rises from its base in proportion to the utilisation (0 to 100%, values outside that range are clamped). The cell's colour changes with load: normal below 60%, warm from 60% up to 85%, hot above 85%. The core number is shown when the card is wide enough. The view remains the "Per-core" detail that can be hidden in Customise, under the same detail id so saved layouts keep working.
- **FR-26.** The honeycomb MUST work for any number of cores from 1 to 128: cells interlock like a honeycomb, rows differ in length by at most one cell (or are all equal and staggered), and the arrangement is chosen so the cluster is close to round. It MUST scale to fill the width and the height its card gives it, without overflowing. *Changed in 0.6.0:* where the honeycomb sits in the CPU card, and how much room it gets, is set by FR-28. The 0.5.0 clause "and the CPU card MUST give it any spare height" now applies only to the narrow (stacked) layout; on a wide card the honeycomb takes the column beside the chart.
- **FR-27.** The honeycomb MUST be exposed to assistive technology as an image named "Per-core utilisation" with a text alternative for every cell ("Core N: X%"), and MUST NOT animate beyond a short transition of the fill, which is disabled under the reduced-motion preference.
- **FR-22.** The UI MUST open its stream with `wss://` when the page is served over HTTPS and with `ws://` when served over HTTP, to the same host on the agent's port (8787) unless a build-time override is set. The override, when set, is used as given.
- **FR-23.** The project MUST provide a documented, reversible way to publish the web UI and the agent stream over HTTPS to the tailnet using Tailscale's built-in HTTPS (no certificates managed by the project, never exposed to the public internet), including allowing the HTTPS page's origin in the agent. It MUST offer enable, disable and status, be safe to run twice, and have a dry run.
- **FR-24.** The project MUST provide one command that upgrades a deployed Mac mini: build the agent, copy the files, install the agent, rebuild the UI, then check the agent, the UI and the stream, and report the URLs. It MUST have a dry run and refuse to report success if a check fails.
- **FR-28.** The CPU card MUST lay out like the README illustration (`docs/images/overview.svg`), based on the card's own width (a container query, FR-20), not the screen's:
  - **Wide card** (content at least 28 rem): the total and the history chart on the left, the honeycomb on the right, side by side. The honeycomb's column is as tall as the row and grows with it when the card is stretched to match a taller neighbour.
  - **Narrow card** (content under 28 rem, which includes a one-column card and a phone): the honeycomb stacks under the chart and takes any spare height (FR-26).
  - The core count ("10 cores") is in the card header, top right, whenever CPU data is available. It is no longer the label under the total.
  - The load average stays visible as the label under the total, while the "Load average" detail is shown.
  - If the chart or the honeycomb is hidden in Customise, the other one takes the full width. No empty column is left.
- **FR-29.** The agent MUST report each listed process's GPU use as a percentage, read without root from the GPU clients in the IORegistry:
  - Over an interval, GPU % = Δ(the process's GPU time) / Δ(wall time) × 100. A process's GPU time is the sum of `accumulatedGPUTime` (nanoseconds) over all of its GPU clients and all of their `AppUsage` entries. The interval is the time between two successful GPU samples.
  - The value is clamped to 0–100.
  - The value is `null` (not 0) when it cannot be known yet: before the second successful GPU sample, for a process seen with GPU clients for the first time, and for one whose summed GPU time went down. A drop happens when a client closes or a pid is reused, and it resets that process's baseline.
  - A process with no GPU clients reads 0 once two successful GPU samples exist.
  - The time is credited to the process macOS names as the client's creator.
- **FR-30.** The process list MUST also include the processes using the most GPU. The list becomes the union of the top 25 by CPU, the top 25 by resident memory and the top 25 by GPU % (only processes above 0), so sorting by GPU in the browser finds the real top users.
- **FR-31.** A failure to read GPU time MUST NOT blank the process table, and a slow read MUST be cut off by a timeout (1 s, plan §3). The list, CPU and memory still arrive, every GPU value is `null`, and the reason is carried in the processes payload (`gpuError`) and shown in the card.
- **FR-32.** The Processes card MUST have a sortable "GPU" column:
  - It shows the percentage like the CPU column, or "–" when the value is `null` or missing (for example from an older agent).
  - Sorting by GPU puts the highest first and `null`s last.
  - It is a hideable detail of the card ("GPU column", part id `gpu`).
  - Like the other columns it responds to the card's width: it is shown from an 18 rem card and hidden below.
  - When the GPU source fails, the card shows "GPU unavailable: <reason>" under the table while the column is shown.
- **FR-33.** The card and the docs MUST say how GPU time is attributed: time is credited to the process macOS names, and system services such as `runningboardd` and `WindowServer` can carry GPU time on an app's behalf. In the card this is the existing "note" detail, which now says this instead of "GPU use per process is not shown yet".

## 6. Non-functional requirements
<!-- Performance, security, privacy, accessibility, compliance, observability. Specific and measurable. -->
- Sampling overhead: the monitor itself stays under 2% of one core on average.
- Read-only: no endpoint changes system or container state.
- Network exposure: reachable on the LAN. Every request and the WebSocket MUST present a shared access token set in configuration; the default config without a token refuses to start. The service never listens on a public interface.
- UI: usable at phone, desktop and wall-display sizes; light and dark themes.
- Customisation is UI-only: no new agent endpoints, no layout data sent to the agent or anywhere else. Layout and theme live in the browser's local storage.
- Accessibility: every customisation control is keyboard operable, has an accessible name, and has a visible focus indicator. Drag and drop has a keyboard alternative. Reduced-motion preferences are respected.
- Robustness: unavailable or full local storage must not break the page (the layout then lasts for the session).
- Performance: customisation must not disturb the 1 Hz update, and the production JavaScript bundle grows by no more than 40 kB gzipped.
- Resizing: while a drag is in progress the layout changes only when the snapped column count changes, so charts are not redrawn on every pointer move.
- Browser support: container-based layout uses CSS container queries (supported by current Chrome, Edge, Safari and Firefox).
- The HTTPS path must not change or break the plain HTTP LAN path.
- The HTTPS path is tailnet-only: Funnel (public) is never enabled, and the scripts refuse to.
- The access token is never logged or printed by either script.
- The honeycomb must add no timers or animation loops, and must render from the per-core values alone (no new agent data).
- Text on a filled cell keeps WCAG AA contrast against its background in both themes.
- The CPU budget still holds with per-process GPU on: agent plus `macmon` under 2% of one core on average, measured on the Mac mini (ADR 0006).
- The GPU column refreshes at most as often as the process list (every 3 s) and may refresh less often to stay inside the budget. The interval is set from the measurement on the Mac mini (plan DD-24). [NEEDS INPUT: the acceptable GPU refresh interval; see §9 Open questions.]
- No root, no new privileges, no new runtime dependencies, and no cgo. The release build stays `CGO_ENABLED=0`.
- Read-only: reading GPU time changes nothing on the system.
- Everything parsed from the IORegistry is bounded: output size, number of clients, a timeout on the read, and validated pids. A bad or slow read fails only the GPU values (FR-31).
- Test fixtures recorded on the Mac mini are sanitised before commit (no real app names beyond system services, no real pids or registry ids).
- The snapshot contract changes additively. The schema version stays 1, a 0.5.x snapshot still validates, and a 0.5.x web build ignores the new fields.

## 7. Data model & contracts
<!-- Typed contracts BEFORE implementation: entities, fields, API shapes, events. The interface code must honour. -->
Snapshot wire format: see `contracts/snapshot.schema.json` (unchanged in 0.2.0).

**0.6.0 snapshot additions** (additive; schema version stays 1; web types are regenerated from the schema):

| Where | Field | Type | Meaning |
| --- | --- | --- | --- |
| `processesData.list[]` | `gpu` | number 0–100, or `null`; optional | GPU % over the last GPU interval (FR-29). `null` = not known yet or the GPU source failed. Missing = an agent older than 0.6.0. |
| `processesData` | `gpuError` | string; optional | Present only when the last GPU read failed (FR-31), for example "ioreg timed out". |

`gpu` is not added to `required`, so 0.5.x snapshots still validate.

**Layout** (browser-only, stored under `minidash.layout`; the theme is stored separately under `minidash.theme` as `"system" | "light" | "dark"` so it can apply before the page renders):

```ts
interface Layout {
  version: 1
  summary: { visible: boolean; hidden: SummaryPart[] }
  cards: Array<{ id: CardId; visible: boolean; span: 1 | 2 | 3 | 4; hidden: string[] }>  // array order = display order
}
type CardId = 'cpu' | 'gpu' | 'memory' | 'network' | 'storage' | 'shares' | 'containers' | 'processes'
```

**Hideable parts** (the catalogue for FR-15):

| Card | Parts |
| --- | --- |
| Summary strip | `cpu`, `gpu`, `memory`, `network`, `power` |
| `cpu` | `chart`, `cores`, `load` |
| `gpu` | `chart`, `clusters`, `temps`, `fans` |
| `memory` | `chart`, `breakdown`, `swap` |
| `network` | `chart`, `interfaces` |
| `storage` | `chart`, `throughput` |
| `shares` | `mounts`, `offered`, `clients` |
| `containers` | `stopped` (runtimes that are not running) |
| `processes` | `user` (owner column), `gpu` (GPU column, added in 0.6.0), `note` (from 0.6.0 the GPU attribution note) |

Adding the `gpu` part keeps layout `version` 1: a saved layout without it shows the column, and an older build ignores the unknown part id (import rules below).

**Default layout:** all cards visible in the 0.1.0 order, with the widths used in 0.1.0, nothing hidden.

**Import rules:** the file is the `Layout` object. Unknown card ids and unknown part ids are ignored; a missing card is appended with its defaults; a span that is not 1, 2, 3 or 4 becomes the card's default (a file from 0.2.0, which only used 1, 2 and 4, imports unchanged; a 0.2.0 build importing a file with width 3 resets that width to the default); a `version` newer than 1 is refused; anything that is not valid JSON of the right shape is refused.

## 8. Acceptance criteria
<!-- Objectively verifiable; each maps to FR-N. These become the tests in Stage 5. -->
- **AC-1.** (FR-1) Given the dashboard is open, when a CPU-heavy process starts, then the CPU graph reflects it within 2 seconds.
- **AC-2.** (FR-2) Given an Apple Silicon host, when a GPU workload runs, then GPU utilisation and unified memory figures change accordingly.
- **AC-3.** (FR-3) Given an external drive is mounted, then it appears with capacity, usage and throughput; when unmounted, it disappears or shows offline.
- **AC-4.** (FR-4) Given traffic on an interface, then its throughput is shown per interface.
- **AC-5.** (FR-5) Given the process table, when sorted by memory, then the top row matches `ps` within one sample.
- **AC-6.** (FR-6) Given only Colima is running, then its containers show and Docker/Podman show as "not running", not as errors.
- **AC-7.** (FR-7) Given an SMB share is mounted, then it is listed with its server and mount point.
- **AC-8.** (FR-8) Given the backend stops, then the UI shows "disconnected" within 5 seconds and recovers on restart without a reload.
- **AC-9.** (FR-10) Given the OS is dark and System is selected, then the UI renders dark; when Light is selected it renders light at once and still does after a reload; the stored choice is applied to the document before the app script runs.
- **AC-10.** (FR-11) Given each theme, then every text/surface and accent/surface pair used for text meets 4.5:1 contrast (checked by a test over the design tokens), and every interactive control has a visible focus style.
- **AC-11.** (FR-12) Given a card is hidden, then it is not in the page; given the summary strip is hidden, then it is not shown; given all are hidden, then the empty state with a restore action is shown.
- **AC-12.** (FR-13) Given the cards CPU then GPU, when GPU is moved earlier by keyboard or by a drag gesture, then GPU renders before CPU and the order survives a reload.
- **AC-13.** (FR-14) Given a card, when its width is set to 1, 2, 3 or 4, then it spans that many columns on large screens, and the setting survives a reload; a layout file that uses only widths 1, 2 and 4 imports unchanged.
- **AC-14.** (FR-15) Given the per-core bars are hidden in the CPU card, then they are not rendered while the CPU total, chart and every other card still are.
- **AC-15.** (FR-16) Given a customised layout, then a reload restores it; Reset restores the default; an exported file imports to an identical layout; an invalid file shows an error and changes nothing; corrupt stored data loads the default; a card missing from an imported file appears with its defaults.
- **AC-16.** (FR-17) Given `?wall`, then the process table and shares card are hidden without changing the saved layout, and leaving wall mode restores them.
- **AC-17.** (NFR) Given layout and theme operations, then no network request is made (the layout code does not touch the agent connection), storage failures do not throw, and the gzipped bundle grew by at most 40 kB (measured).
- **AC-18.** (FR-18) Given Customise is open on a four-column grid, when a card's right edge is dragged across column boundaries, then its width follows the pointer snapped to 1 to 4 columns and shows live; when Escape is pressed during the drag the width returns to what it was; releasing keeps the width and it survives a reload. Given the resize control is focused, Left and Right change the width by one column, stopping at 1 and 4, and its value is exposed as a slider with its current width.
- **AC-19.** (FR-19) Given Customise is open, when a card is clicked, then it is outlined and the sidebar shows only that card's settings; clicking another card switches; Escape or the way back returns to the overview; selecting from the overview list does the same; the layout is unchanged by selecting. Given Customise is closed, clicking a card selects nothing.
- **AC-20.** (FR-20) Given any card, then it is a size container and its internal layout responds to the card's own width rather than the viewport (checked by tests over the components), and at the widths of a one-column card and a full-width card the owner finds nothing clipped, overflowing or cramped (visual review).
- **AC-21.** (FR-21) Given the grid, then it is one column below 768 px, two from 768 px and four from 1024 px; at two columns widths 2, 3 and 4 span the full row and width 1 takes half.
- **AC-22.** (FR-22) Given a page at `https://host`, then the stream URL is `wss://host:8787/ws`; given `http://host`, then it is `ws://host:8787/ws`; given a build-time override, then exactly that URL is used (unit tests).
- **AC-23.** (FR-23) Given the enable command, then the tailnet serves the UI on HTTPS 443 and the agent on HTTPS 8787, the agent's allowed origins include the tailnet host name, and the agent is restarted; given enable twice, then nothing is duplicated; given disable, then the serve config and the added origin are removed; given dry run, then nothing changes; given a request to expose publicly, then it refuses (tests with a stubbed `tailscale`). Live on the Mac mini, `https://<tailnet-host>` loads the UI and the browser's `wss://` stream is accepted.
- **AC-24.** (FR-24) Given the upgrade command with dry run, then it prints the plan and changes nothing; given a real run against the Mac mini, then the agent is healthy, the UI container is running, the stream is accepted, and the URLs are printed; given a failed check, then it exits non-zero.
- **AC-25.** (FR-25) Given per-core values, then each core has one cell showing its rounded percentage; the fill is proportional to the value and clamped to 0 to 100% (NaN counts as 0); the colour tier switches at exactly 60% and 85%; the core number is shown from a medium card width; hiding the "Per-core" detail removes the honeycomb and leaves the rest of the card.
- **AC-26.** (FR-26) Given any core count from 1 to 128, then the cells number exactly that count, rows differ by at most one cell (or are all equal and staggered), no two cells overlap, every cell lies inside the drawing, and the cluster's aspect ratio stays within a sane range (unit tests); the view scales to its container and the CPU card gives it the spare height (structure test, and the owner's visual review). *Changed in 0.6.0:* "the CPU card gives it the spare height" is checked only for the narrow (stacked) layout; its place on a wide card is checked by AC-28.
- **AC-27.** (FR-27) Given the honeycomb, then it has the role "img" and the name "Per-core utilisation", every cell has a "Core N: X%" text alternative, and no keyframe animation is used.
- **AC-28.** (FR-28, FR-26) Given CPU data, the header shows "N cores" at the top right and the total's label is the load average. Given the "Load average" detail is hidden, the label is gone and the header still shows the count. The chart and the honeycomb sit in a container that is a column by default and a row from the `@md` container width (28 rem), with the honeycomb's box stretching to the row's height. Hiding either one leaves the other at full width. No viewport breakpoint is used inside the card. These are checked by component and structure tests. **Owner's eye:** in a browser on the Mac mini, a width-2 card on the four-column grid shows the two side by side as in the illustration; a width-1 card and a phone-width card show the honeycomb under the chart; neither is squashed, clipped or overflowing.
- **AC-29.** (FR-29) Unit tests over recorded and synthetic fixtures, with a fake clock, show:
  - Several clients and several `AppUsage` entries for one pid are summed.
  - Two samples 3 s apart whose summed time grows by 1.5 s give 50%.
  - The first sample gives `null` for every process.
  - A pid first seen in the second sample gives `null`.
  - A pid whose sum went down gives `null`, and the next interval is measured from the new baseline.
  - A process with no GPU clients gives 0.
  - A computed value above 100 is reported as 100, and one below 0 is never reported.
  - **Owner's eye (live, on the Mac mini):** with a Metal workload running, its process shows a GPU % that rises and falls with the workload and is in the same range as Activity Monitor's "% GPU" column.
- **AC-30.** (FR-30) Given a process with high GPU % but low CPU and memory, which is outside both top-25 lists, then it is in the list. Given processes with 0 GPU, then no extra processes are added for GPU. Each process appears once (unit test with fakes).
- **AC-31.** (FR-31, FR-32) Given the GPU reader fails (error, timeout, oversized output, malformed output), then the processes result is `ok` with the full list, every `gpu` is `null`, `gpuError` names the reason, and the collector's run time stays within the reader's timeout (agent unit tests). Given that payload, the card renders every row with "–" in the GPU column and shows "GPU unavailable: <reason>" (web test).
- **AC-32.** (FR-32) Given processes with GPU values, `null`s and a missing field:
  - Clicking "GPU" sorts highest first with `null`s and missing values last, and marks the column `aria-sort="descending"`.
  - `null` and missing render "–".
  - The column's header and cells use the `@2xs` container variant.
  - Hiding the "GPU column" detail removes the header and cells, and the CPU, memory and other columns are unaffected.
  - A saved layout without the `gpu` part loads with the column shown.
  - These are component, layout-model and responsive tests. **Owner's eye:** the column is readable and nothing overflows at one-column and full card width.
- **AC-33.** (FR-33) Given the Processes card with the note shown, it says that GPU time is credited to the process macOS names and that `runningboardd` and `WindowServer` can carry it for apps (web test). `docs/collectors.md`, `docs/troubleshooting.md` and the README's known limits say the same (checked in review).
- **AC-34.** (NFR contract) Given the updated schema, these validate: a 0.5.x processes payload with no `gpu` field; a payload with numbers, `null`s and `gpuError`; and a snapshot the 0.6.0 agent produces. A `gpu` value below 0 or above 100 is rejected (agent schema tests). The regenerated web type has `gpu?: number | null` and `gpuError?: string`, and `tsc -b` passes.
- **AC-35.** (NFR budget) On the Mac mini, measured over 60 s with one client connected and per-process GPU on at the chosen interval, agent plus `macmon` average under 2% of one core. The figures before and after are recorded in `docs/collectors.md` (manual measurement on real hardware).

## 9. Open questions
<!-- Unresolved decisions blocking approval. An approved spec has none (or each is deferred with an owner). -->
Resolved 2026-10-18 by owner: LAN exposure with shared token; network accounts = both; `macmon` helper acceptable; stack in plan.md §2 approved; deployment is containerised (see plan DD-4).

Also resolved (owner delegated to recommendation): share types are SMB and NFS only; overhead target is 2% of one core.

Resolved 2026-10-18 by the owner for 0.2.0: customisation covers show/hide cards, reorder by drag and drop, resize cards and hide parts inside cards; the layout is saved per browser with export/import (the agent stays read-only); themes are a System/Light/Dark switch.

Resolved 2026-10-18 by the owner for 0.3.0: resizing is by width only, snapping to columns (adding a 3-column width); selection is by clicking a card while Customise is open, with a per-card sidebar.

Resolved 2026-10-18 by the owner for 0.4.0: HTTPS through Tailscale Serve, an upgrade script, promote v0.3.0, and mark the specs implemented. Enabling Serve on the tailnet is an account setting only the owner can change (https://login.tailscale.com/f/serve).

Resolved 2026-10-18 from the owner's request and screenshot: replace the per-core bars with a hexagonal reactor-style honeycomb that fills the card.

Resolved 2026-10-18 by the owner for 0.6.0:

- **A. CPU card layout.** Match the README illustration. On a wide card the chart is on the left and the honeycomb on the right; the core count is in the header at the top right; on a narrow card (one column, phone) the honeycomb stacks under the chart. Use container queries as in ADR 0010. This replaces 0.5.0's "the reactor fills the spare height below the chart" (FR-26 and AC-26 are amended in place; FR-28 and AC-28 hold the new layout). Keep the load average visible. The fill-clipping bug is fixed in hotfix 0.5.2, not here.
- **B. Per-process GPU %.**
  - Read without root from `AGXDeviceUserClient` entries in the IORegistry (`IOUserClientCreator`, `AppUsage[].accumulatedGPUTime`), summed per pid (ADR 0014).
  - GPU % = Δ GPU time / Δ wall time, like the CPU column. A pid seen for the first time is `null`; a counter that goes down resets that pid's baseline. Clamp sensibly.
  - Credit time to the process macOS names, with a note that `runningboardd` and `WindowServer` can carry time for apps.
  - The schema change is additive and optional.
  - The release build stays `CGO_ENABLED=0`. The plan picks how to read the registry and records the rejected alternatives, and a task measures the CPU cost on the mini.
  - A GPU failure must not blank the process table: the column shows "–" and the error is reported.
  - The column is sortable (nulls last), hideable as a card detail and responsive.
  - The old risk note in the plan is replaced with the real risks.
- **C. Carried gaps.** Keep the accepted-gaps list and add AC-26's visual review to it.

Decisions made while drafting 0.6.0 that the owner did not cover. They are recorded here for review before approval:

- **D1. Clamp to 0–100%, no values over 100.** Overlapping GPU work across one process's clients could sum to more than the wall time. The column is read against the GPU card's system-wide 0–100% and Activity Monitor's "% GPU", so 100 means "fully busy" (FR-29).
- **D2. A process with no GPU clients reads 0, not `null`,** once two GPU samples exist. Only processes that cannot be measured yet are `null`, so the column is not mostly "–" (FR-29).
- **D3. The list adds the top 25 by GPU %** to the CPU and memory unions. Without this, a process that is busy on the GPU but light on CPU and memory would never reach the browser, and sorting by GPU would mislead (FR-30).
- **D4. The error travels in a new optional `gpuError` field,** and the card shows it under the table while the GPU column is shown (FR-31, FR-32). The processes result stays `ok`.
- **D5. Breakpoints.** The CPU card goes side by side from the `@md` container width (28 rem). This is the smallest existing variant that a width-2 card on the four-column grid always reaches, from 28 rem at a 1024 px window to 37.5 rem at full width, while a width-1 card (12.5 to 17.25 rem) and a phone (about 19.5 to 23 rem) stack. The GPU column shows from `@2xs` (18 rem, already used in the cards), so it stays visible on a phone from 360 px wide (FR-28, FR-32; plan §3).
- **D6. The registry is read by forking `ioreg -a` and decoding its plist output** with the plist library the agent already uses. The text output (`-w0`) with a hand-written parser was not chosen (plan §2, DD-21).
- **D7. The existing `note` detail id is reused for the attribution note,** so saved layouts that hid it keep it hidden (FR-33).
- **D8. The GPU sampling interval is configurable** (`MINIDASH_PROC_GPU_INTERVAL_MS`; `0` turns the GPU reader off). This gives a way out if the cost or the source misbehaves on another macOS version (plan DD-24).

Open questions:

- [NEEDS INPUT: GPU refresh interval. On a dev Mac (M4 Pro), one `ioreg` read costs about 18 ms of CPU, so every 3 s adds about 0.6% of a core. The measured total today is 1.4% to 1.65%, so 3 s may break the 2% budget. Is a GPU column that refreshes every 6 or 9 s acceptable (plan DD-24 picks the shortest that fits, from the measurement on the mini), or should the in-process IOKit reader be built to keep 3 s?]

**Accepted gaps.** The owner asked on 2026-10-18 for the specs to be marked implemented. These checks need real hardware, a browser or an account setting, and no result has been recorded for them:

- **AC-2** (spec 0.1.0): the GPU-load check on the Mac mini.
- **AC-12 and AC-18** (specs 0.2.0 and 0.3.0): real mouse and touch dragging and resizing in a browser. The keyboard paths and the snapping maths are tested.
- **AC-20** (spec 0.3.0): the visual review of cards at one-column and full width.
- **AC-23, live clause** (spec 0.4.0): the HTTPS page over Tailscale. It needs the owner to enable Tailscale Serve for the tailnet (https://login.tailscale.com/f/serve). The script's behaviour when Serve is off was verified live.
- **AC-26, visual clause** (spec 0.5.0; added to this list in 0.6.0): the owner's review of the reactor in a browser on the Mac mini at several card widths and heights. The spare-height part now applies only to the stacked layout (FR-26 as amended); the wide layout is reviewed under AC-28.

They are listed with their steps in `docs/deploy.md`. Specs 0.1.0 to 0.5.0 are frozen history; 0.6.0 is the cumulative current contract.

**Checks in 0.6.0 that need the owner's eye** (they will become accepted gaps if no result is recorded at release): AC-28's visual clause, AC-29's live clause, and AC-32's visual clause. AC-35 needs the Mac mini but not the owner: it is a measurement.

**Accepted gaps for 0.5.0.** Spec 0.5.0 was marked implemented on 2026-10-18 when preparing release 0.5.0. Every task is done and the web tests pass (270 tests). AC-25 and AC-27 are fully covered by automated tests (`CoresReactor.test.tsx`, `reactor.test.ts`, the reactor contrast check in `contrast.test.ts`, and the Dashboard and Customise tests for hiding the detail). AC-26 is covered by `honeycomb.test.ts` for every count from 1 to 128 and by a structure test that the reactor scales to its container. These parts need a human eye, and no result has been recorded for them:

- **AC-26, visual clause** (spec 0.5.0): the owner's review of the reactor in a browser on the Mac mini, at several card widths and heights, including that the CPU card gives the reactor its spare height. The card's flex layout that provides the spare height is not asserted by a test. The UI was deployed with `deploy/upgrade.sh` and all four checks passed (T-32).

## Changelog

| Version | Date | Level | Note |
| --- | --- | --- | --- |
| 0.6.0 | 2026-10-18 | minor | CPU card side by side; per-process GPU % |
| 0.5.0 | 2026-10-18 | implemented | Marked implemented for release 0.5.0, with the visual review of the reactor as an accepted gap (section 9) |
| 0.5.0 | 2026-10-18 | approve | Approved from the owner's request and screenshot: a hexagonal reactor-style core view |
| 0.5.0 | 2026-10-18 | minor | CPU cores shown as a honeycomb reactor of hexagons that fills the card |
| 0.4.0 | 2026-10-18 | implemented | Marked implemented at the owner's request, with the accepted gaps listed in section 9 |
| 0.4.0 | 2026-10-18 | approve | Approved by the owner's request: HTTPS through Tailscale Serve and a one-command upgrade |
| 0.4.0 | 2026-10-18 | minor | Encrypted access over Tailscale HTTPS (wss), and a one-command upgrade for the Mac mini |
| 0.3.0 | 2026-10-18 | approve | Approved by the owner's answers: width-only resize snapping to columns, click-to-select with a per-card sidebar |
| 0.3.0 | 2026-10-18 | minor | Responsive cards (viewport and container), drag-to-resize snapping to 1-4 columns, click-to-select with a per-card sidebar |
| 0.2.0 | 2026-10-18 | approve | Approved by the owner's answers: all four customisation features, per-browser layout with export/import, System/Light/Dark switch |
| 0.2.0 | 2026-10-18 | minor | UX: restyle to match the README illustration, theme switch, customisable layout (show/hide, reorder, resize, hide parts) |
| 0.1.0 | 2026-10-18 | major | Approved: LAN+token, SMB/NFS, 2% budget, native agent + container UI |
| 0.0.1 | 2026-10-18 | init | Initial draft |