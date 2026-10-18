# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow the spec version in `spec/`, and each is published as a [GitHub Release](https://github.com/devdaviddr/minidash/releases) when tagged (see [docs/releasing.md](docs/releasing.md)).

## [Unreleased]
### Added (spec 1.3.0)
- **HTTPS over Tailscale:** `deploy/tailscale-https.sh on|off|status` publishes the UI (HTTPS 443) and the agent stream (HTTPS 8787) to your tailnet with `tailscale serve`, so the token and metrics are encrypted. Reversible, idempotent, with a dry run; it allows the HTTPS origin in the agent, never uses Funnel (public), and explains (without hanging) when Serve is not enabled on the tailnet. Plain HTTP on the LAN keeps working. ADR 0012.
- **`wss://` from HTTPS pages:** the UI opens its stream with `wss://` when the page is HTTPS and `ws://` when it is HTTP (browsers block `ws://` from HTTPS pages). A build-time override is used as given.
- **One-command upgrade:** `deploy/upgrade.sh [--host NAME] [--dry-run]` builds, copies, installs, rebuilds the UI, then checks the agent, the UI container, the UI page and the live stream, and exits non-zero without claiming success if any check fails.

### Changed
- Docs: deploy, operations, security, configuration, troubleshooting and the deployment diagram cover HTTPS and the upgrade script.

## [1.2.0] - 2026-10-18
Spec 1.1.0 (themes, restyle, customisable layout) and spec 1.2.0 (select, resize, responsive cards) shipped together, so there is no separate 1.1.0 release.

### Added
- **Theme switch:** System, Light and Dark, remembered per browser and applied before first paint (no flash); charts recolour immediately.
- **Customise panel:** show or hide cards, the summary strip and details inside cards; reorder by drag and drop (mouse, touch, keyboard) or with move buttons; reset, export and import the layout as JSON (validated, never destructive). Saved in the browser; the agent stays read-only.
- **Click to select:** while Customise is open, clicking a card outlines it and the sidebar shows just that card (show/hide, order, width, details). The overview list can select too, so no pointer is needed.
- **Drag to resize:** a grip on each card's right edge snaps its width to 1, 2, 3 or 4 columns with a live badge. Escape cancels; the grip is also a keyboard slider. New width: **3 columns**.
- **Responsive cards:** every card adapts to its own width with container queries (tiles, runtimes, volumes, share sections and table columns rearrange or simplify), and the page grid is 1 column below 768 px, 2 from 768 px and 4 from 1024 px.

### Changed
- Restyled to match the README illustration: brand mark, status pill with a live dot, larger summary values, gradient chart fills.
- Light and dark colour tokens adjusted so every text pair meets WCAG AA (4.5:1); a test reads the real CSS. This also fixed white-on-accent button text at 2.9:1 in dark.
- Status pill uses theme tokens instead of fixed pale colours that were unreadable on light.
- Page title is now `minidash`.

### Fixed
- The drag handle used a Braille character that many fonts lack; it is now a drawn icon.

### Process
- Every PR is squash-merged ([ADR 0011](docs/adr/0011-squash-merge-and-labelled-releases.md)): the PR title and description become the commit on `main` and the release note. Rebase and merge commits are turned off.
- PRs are labelled automatically from their Conventional Commit title and size; release notes are grouped by those labels.
- Releases are published by a workflow when a `vX.Y.Z` tag is pushed: tests, the agent for Apple Silicon, the built web UI, checksums and grouped notes. They start as pre-releases.

### Documentation
- Customising guide, releasing guide, and decision records 0009 (browser-side layout and theme), 0010 (container queries and width-only resize) and 0011 (squash-merge and releases).

## [1.0.0] - 2026-10-18
First complete implementation of spec 1.0.0. Pending before it is marked `implemented`: a GPU-load check (AC-2) and a visual review in a browser.

### Added
- Go agent that samples the machine once a second and streams snapshots over an authenticated WebSocket (token as the first message, constant-time comparison, origin allow-list).
- Collectors: CPU, unified memory, SoC (GPU, power, temperatures, fans via `macmon`), disks (internal and external, per-disk throughput), network, processes, containers (Docker, Podman, Colima) and shares (mounts, offered shares, connected clients).
- React web UI with live charts, a summary strip, light and dark themes and a wall-display mode.
- JSON Schema contract shared by the agent and the UI, with generated TypeScript types.
- launchd installer for the agent and a hardened nginx container for the UI.
- Spec-driven workflow: versioned spec, plan and tasks; Claude rules, hooks and skills; git hooks; CI.
- Community files: contributing guide, security policy, code of conduct, issue templates, CODEOWNERS and Dependabot configuration.

### Changed
- CPU budget: agent plus `macmon` measured at about 1.65% of one core on the Mac mini (budget 2%). Achieved by caching `vm_stat`, reading 64-bit network counters from a sysctl instead of forking `netstat`, looking up process names lazily, and throttling slow collectors. `macmon` samples every 2 s by default.

### Fixed
- Installer function shadowed `/usr/bin/install`, so a real install recursed (found while deploying; the dry run hid it).
- nginx dropped the security headers on every response, because location-level `add_header` discards server-level ones.
- Token form rendered as a black box with invisible text on the light theme; it now uses theme colours.
- Network byte counters wrapped at 4 GB when read from `NET_RT_IFLIST2`; replaced with the 64-bit `ifmib` sysctl.
- CI no longer fails on the spec template's own `[NEEDS INPUT]` instruction text, and macOS-only tests skip on Linux.

### Documentation
- Architecture with diagrams, configuration, operations, troubleshooting, security model and development guide; decision records 0002 to 0008.
- README with a banner, a dashboard layout illustration (clearly labelled, made-up values), badges, requirements, a performance table and a quick start.

[Unreleased]: https://github.com/devdaviddr/minidash/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/devdaviddr/minidash/compare/v1.0.0...v1.2.0
[1.0.0]: https://github.com/devdaviddr/minidash/releases/tag/v1.0.0
