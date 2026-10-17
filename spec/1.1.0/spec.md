---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 1.1.0
status: approved
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

Version 1.1.0 adds a UX layer. The first build shows every card in one fixed order, follows the operating system's colour scheme with no way to override it, and looks plainer than the project's own README illustration. People use the dashboard in different places (a wall display, a second monitor, a phone) and care about different data there, so the page should look polished, let the viewer pick a theme, and let them choose which cards and details appear, in what order and how large.

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

## 3. Non-goals
<!-- Out of scope for this version. -->
- Long-term metric storage and alerting (live view only until a later version).
- Monitoring machines other than the Mac mini.
- Controlling the machine or containers (read-only dashboard).
- Syncing layouts between devices through the agent (the agent stays read-only; use export and import).
- Several named layouts or presets (one layout per browser).
- User-defined colours or custom themes.
- Free-form pixel positioning. Cards flow in a grid; the viewer chooses order and width.

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
- **FR-14.** The viewer MUST be able to set each card's width to 1, 2 or 4 grid columns. On narrow screens cards stack in one column in layout order.
- **FR-15.** The viewer MUST be able to hide optional parts inside a card (the catalogue is in §7). Hidden parts are not rendered; the rest of the card is unaffected.
- **FR-16.** The layout MUST be saved per browser automatically and restored on load. The viewer MUST be able to reset to the default layout, export the layout to a JSON file, and import one. Import MUST validate the file, refuse invalid files with a clear message and leave the current layout unchanged. Corrupt stored data MUST fall back to the default layout without breaking the page. Cards added by future versions MUST appear automatically.
- **FR-17.** The existing wall-display mode (`?wall`) MUST keep working on top of the layout (it hides the process table and shares card) without overwriting the saved layout.

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

## 7. Data model & contracts
<!-- Typed contracts BEFORE implementation: entities, fields, API shapes, events. The interface code must honour. -->
Snapshot wire format: see `contracts/snapshot.schema.json` (unchanged in 1.1.0).

**Layout** (browser-only, stored under `minidash.layout`; the theme is stored separately under `minidash.theme` as `"system" | "light" | "dark"` so it can apply before the page renders):

```ts
interface Layout {
  version: 1
  summary: { visible: boolean; hidden: SummaryPart[] }
  cards: Array<{ id: CardId; visible: boolean; span: 1 | 2 | 4; hidden: string[] }>  // array order = display order
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
| `processes` | `user` (owner column), `note` |

**Default layout:** all cards visible in the 1.0.0 order, with the widths used in 1.0.0, nothing hidden.

**Import rules:** the file is the `Layout` object. Unknown card ids and unknown part ids are ignored; a missing card is appended with its defaults; a span that is not 1, 2 or 4 becomes the card's default; a `version` newer than 1 is refused; anything that is not valid JSON of the right shape is refused.

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
- **AC-13.** (FR-14) Given a card, when its width is set to 1, 2 or 4, then it spans that many columns on large screens, and the setting survives a reload.
- **AC-14.** (FR-15) Given the per-core bars are hidden in the CPU card, then they are not rendered while the CPU total, chart and every other card still are.
- **AC-15.** (FR-16) Given a customised layout, then a reload restores it; Reset restores the default; an exported file imports to an identical layout; an invalid file shows an error and changes nothing; corrupt stored data loads the default; a card missing from an imported file appears with its defaults.
- **AC-16.** (FR-17) Given `?wall`, then the process table and shares card are hidden without changing the saved layout, and leaving wall mode restores them.
- **AC-17.** (NFR) Given layout and theme operations, then no network request is made (the layout code does not touch the agent connection), storage failures do not throw, and the gzipped bundle grew by at most 40 kB (measured).

## 9. Open questions
<!-- Unresolved decisions blocking approval. An approved spec has none (or each is deferred with an owner). -->
Resolved 2026-10-18 by owner: LAN exposure with shared token; network accounts = both; `macmon` helper acceptable; stack in plan.md §2 approved; deployment is containerised (see plan DD-4).

Also resolved (owner delegated to recommendation): share types are SMB and NFS only; overhead target is 2% of one core.

Resolved 2026-10-18 by the owner for 1.1.0: customisation covers show/hide cards, reorder by drag and drop, resize cards and hide parts inside cards; the layout is saved per browser with export/import (the agent stays read-only); themes are a System/Light/Dark switch.

No open questions.

## Changelog

| Version | Date | Level | Note |
| --- | --- | --- | --- |
| 1.1.0 | 2026-10-18 | approve | Approved by the owner's answers: all four customisation features, per-browser layout with export/import, System/Light/Dark switch |
| 1.1.0 | 2026-10-18 | minor | UX: restyle to match the README illustration, theme switch, customisable layout (show/hide, reorder, resize, hide parts) |
| 1.0.0 | 2026-10-18 | major | Approved: LAN+token, SMB/NFS, 2% budget, native agent + container UI |
| 0.1.0 | 2026-10-18 | init | Initial draft |
