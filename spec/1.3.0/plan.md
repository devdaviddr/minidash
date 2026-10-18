---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 1.3.0
status: approved
updated: 2026-10-18
---
# minidash realtime Mac mini monitor — Implementation Plan

> **Stage 2 · PLAN** — select the tech and architecture. This is the *how* for the requirements in
> `spec.md` at this same version. Every decision here should trace back to an FR / NFR.
>
> **Don't assume the stack.** Ask the user about existing platform, datastore, framework, and
> constraints before choosing. Mark unknowns as `[NEEDS INPUT: question]`.

## 1. Approach summary
A small native agent on the Mac mini samples system metrics once a second and streams one JSON snapshot per tick over a WebSocket to a single-page web app. The agent also serves that app as static files, so deployment is one binary under launchd. Status: stack approved by owner 2026-10-18; spec approval pending (spec §9). Version 1.2.0 refines it with resizing, selection and container-aware cards. Version 1.1.0 adds a browser-only UX layer (themes, restyle, customisable layout); the agent and the wire contract do not change.

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

**Added in 1.1.0 (web only):**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Pointer, touch and keyboard sensors with screen-reader announcements built in; headless, so it styles with Tailwind. Serves FR-13 and the accessibility NFR. | Native HTML5 drag and drop (no touch, weak keyboard support); hand-rolled pointer logic (re-implements what dnd-kit already tests) |
| Layout state | A pure reducer plus a `useLayout` hook over `localStorage` | Small, fully unit-testable, no store dependency. Serves FR-12 to FR-16. | Zustand or Redux (a dependency for one small state tree) |
| Theme | `data-theme` attribute on `<html>`, CSS variables, and a tiny same-origin `theme-init.js` loaded in `<head>` | Applies before first paint without an inline script, which the container's CSP (`script-src 'self'`) would block. Serves FR-10. | Inline script (blocked by CSP); theme in React state only (flash of the wrong theme) |
| Layout validation | A small handwritten validator | One small type with exact, documented repair rules (spec §7). | `ajv` or `zod` (a dependency for one type) |
| Tests | Existing Vitest + Testing Library + jsdom, plus a contrast test over the design tokens | Same tools as 1.0.0. dnd-kit's keyboard sensor can be driven from tests. | Playwright (needs a real browser; the owner reviews visuals) |

**Added in 1.2.0 (web only, no new dependencies):**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| Card-aware layout | Tailwind v4 built-in container queries (`@container`, `@xs:` to `@4xl:` variants) | A card responds to its own width, which is what a 1-column and a full-width card need, with no JavaScript and no plugin. Serves FR-20. | A `ResizeObserver` hook setting a size class (testable in jsdom, but re-renders on every resize and duplicates what CSS does natively); viewport breakpoints (wrong unit: the same viewport hosts cards of every width) |
| Resize drag | Small pointer-events hook with pointer capture, plus a pure `spanFromPointer` function | Snapping to columns is simple arithmetic; a pure function is unit-testable without a layout engine. Serves FR-18. | dnd-kit (built for moving and sorting, not edge resizing); a resize library (a dependency for 20 lines of arithmetic) |
| Selection | A `selectedId` in app state, shared by the grid and the sidebar | One source of truth; selecting never touches the layout. Serves FR-19. | Storing selection in the layout (it is transient UI state and must not persist) |
| Viewport grid | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` with span classes per column count | Serves FR-21. | A custom media-query grid (Tailwind already provides it) |

**Added in 1.3.0:**

| Area | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| HTTPS | `tailscale serve` (HTTPS 443 to the UI, HTTPS 8787 to the agent) | Tailscale issues and renews certificates for the tailnet name; nothing for us to manage; tailnet-only. Serves FR-23. | A reverse proxy of our own with Let's Encrypt (certificates to renew, port 443 collisions with Traefik); TLS in the agent (key management in the agent); Funnel (public) |
| UI scheme | A pure `agentUrl(location, override)` function | Testable without a browser. Serves FR-22. | Inline logic in App (untested) |
| Scripts | Bash with a `--dry-run` and a stubbable `tailscale`/`ssh` | Matches the existing installer; testable with stubs. Serves FR-23, FR-24. | A Go or Node CLI (a runtime to install for a handful of commands) |

## 3. Architecture
collectors (cpu, gpu, mem, disk, net, procs, containers, shares) -> snapshot aggregator (1 Hz) -> WebSocket hub -> browser store -> chart/table components. Each collector sits behind a small interface so it can fail independently and be faked in tests.

**Web layer in 1.1.0.**

- **Card registry** (`web/src/layout/registry.ts`) is the single source of truth: each entry has an `id`, title, component, default span and its hideable parts. Layout validation, the customise panel and the grid all read from it, so adding a card is one entry.
- **Layout module** (`web/src/layout/`): the `Layout` type and defaults, `validate` (repairs and refuses per spec §7), a reducer (`toggleCard`, `move`, `setSpan`, `togglePart`, `reset`, `importLayout`) and `useLayout` (reads and writes `localStorage` inside try/catch, falls back to memory).
- **Dashboard grid** renders `layout.cards` in order, skipping hidden ones, each wrapped in a sortable item whose width class comes from its span. Cards receive a `hidden` set and omit those parts.
- **Customise panel** (a side sheet opened from the header): per-card visibility, width and part toggles, move earlier/later buttons, reset, export, import. Drag handles appear on cards while customising.
- **Theme module**: `ThemeSwitch` writes `minidash.theme` and sets `data-theme`; `theme-init.js` does the same from storage before paint. A small `useThemeVersion` hook re-renders `Chart` when the effective theme changes, so uPlot colours update.
- **Wall mode** is applied after the layout: it filters out `processes` and `shares` for display only and never writes to storage.

**Visual style (FR-11).** The 1.0.0 tokens already match the illustration's palette; 1.1.0 restyles the structure to match it: brand mark and wordmark in the header, status pill, summary strip, card header typography (small caps title, large value), 14 px card radius, gradient area fills under chart lines, tile-style secondary metrics, consistent 16/24 px spacing. Light and dark are two token sets:

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#0b0d11` | `#f4f5f7` |
| `--surface` | `#14171d` | `#ffffff` |
| `--line` | `#232832` | `#e3e6eb` |
| `--fg` | `#e8ebf0` | `#12151a` |
| `--muted` | `#8a93a3` | `#6a7280` |
| `--accent` | `#6c93ff` | `#3b6df5` |

A test computes WCAG contrast for the text pairs in both sets (AC-10); a failing pair fails the build.

**1.2.0 additions.**

- **Container-aware cards.** The shared `Card` is a size container (`@container`). Anything inside that depends on space uses container variants, never viewport ones: tile grids, runtime columns, table columns, bar heights, wrapping headers. Card content width at four columns on a 1280 px screen is roughly 17 rem (1 column), 36 rem (2), 57 rem (3) and 77 rem (4), so the working breakpoints are `@sm` (24 rem), `@xl` (36 rem) and `@3xl` (48 rem). A test fails if a card component uses a viewport breakpoint for its inner layout.
- **Grid.** One column below `md`, two from `md`, four from `lg`. Span classes map width 2 to 4 to the full row at `md`, and width 1 to half.
- **Resize grip.** While Customise is open and the grid has four columns, each card shows a grip on its right edge. `spanFromPointer(x, cardLeft, columnWidth, gap, columns)` turns a pointer position into a snapped width; the hook dispatches `setSpan` only when that value changes, and Escape restores the starting width. The grip is a keyboard-operable `role="slider"` (1 to 4).
- **Selection.** `selectedId` lives in the app. Clicking a card while Customise is open selects it; the overview list can also select, so keyboard users never need the pointer. The sidebar is a detail view for the selected card or the overview list with the file controls.

**HTTPS path (1.3.0).** `tailscale serve` terminates TLS on the Mac mini and forwards to local plain HTTP: `https://<host>.ts.net/` to `127.0.0.1:8080` (the UI container) and `https://<host>.ts.net:8787/` to `127.0.0.1:8787` (the agent). The browser loads the UI over HTTPS and opens `wss://<host>.ts.net:8787/ws`. The agent's `MINIDASH_ORIGINS` gains `<host>.ts.net` so the HTTPS page's Origin is accepted. The LAN HTTP ports are unchanged. `deploy/tailscale-https.sh on|off|status` manages this, and `deploy/upgrade.sh` deploys to the mini.

## 4. Data & contracts
<!-- Concrete realisation of spec.md §7: schemas, API endpoints, message/event shapes, storage. Define typed contracts before coding. -->
```
```

The `Layout` type, the default layout, the part catalogue and the import repair rules are specified in spec §7 and implemented in `web/src/layout/`. Storage keys: `minidash.layout` (JSON `Layout`) and `minidash.theme` (`"system" | "light" | "dark"`). The export file is the `Layout` JSON, downloaded as `minidash-layout.json`. The snapshot contract is unchanged.

`Layout.cards[].span` widens from `1 | 2 | 4` to `1 | 2 | 3 | 4` (spec §7). Layout `version` stays 1: the change is additive, 1.1.0 files import unchanged, and a 1.1.0 build repairs a width of 3 to the card's default. Selection is not part of the layout and is never stored.

## 5. Key decisions & trade-offs
<!-- The decisions a future reader would otherwise re-litigate. One line each: decision → rationale. -->
- **DD-1.** Collectors fail independently: one broken source never blanks the dashboard. (FR-6, FR-8)
- **DD-2.** Read-only agent, localhost bind by default. (NFR network exposure)
- **DD-4.** Deployment is container-based, but a container on macOS runs in a Linux VM and cannot see the host's CPU, GPU, memory, disks, shares or `macmon`. So the collecting agent is a small native process under launchd (host access, read-only), and the web UI plus its static server is the container. The container reaches the agent over the LAN with the shared token. Owner asked for "container"; this is the part that cannot be one. (FR-1..FR-9)
- **DD-5.** Access control is a shared token (config, constant-time compare, refuses to start without one), over LAN. (NFR network exposure)
- **DD-3.** Privileged data (e.g. powermetrics) is isolated in a separate optional helper, never in the main agent.
- **DD-6.** Layout and theme are browser state in `localStorage`, exported and imported as JSON. The agent stays read-only and gains no endpoints. A shared, agent-side layout was considered and rejected for 1.1.0 because it would make the agent write state. (Non-goals, NFR privacy)
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

## 6. Risks & mitigations
<!-- What could go wrong technically, and the plan if it does. -->
- **Risk:** per-process GPU use is not exposed by macOS without root. **Mitigation:** show system GPU only; per-process GPU marked unavailable.
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

## 7. Rollout & observability
<!-- How it ships, how it's measured, how it's rolled back. Maps to NFRs. -->
-

1.1.0 changes only the web container. Build and redeploy it (`docker compose -f deploy/compose.yaml up -d --build`); the agent is untouched. Rollback is the previous image. Stored layouts carry `version: 1`, so a future incompatible change can detect and migrate them. Document the customisation features in the README and `docs/` as part of T-19.