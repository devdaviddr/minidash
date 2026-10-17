# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow the spec version in `spec/` rather than git tags until a first release is cut.

## [Unreleased]
### Added (spec 0.2.0)
- **Theme switch:** System, Light and Dark, remembered per browser and applied before first paint; charts recolour immediately.
- **Customisable layout:** show or hide cards, the summary strip and details inside cards; reorder by drag and drop (mouse, touch, keyboard) or with move buttons; set each card to 1, 2 or full width. Saved in the browser, with reset, export and import (validated, never destructive).
- Restyle to match the README illustration: brand mark, status pill with a live dot, larger summary values, gradient chart fills.
- Guide: `docs/customising.md`; ADR 0009.

### Changed
- Light and dark colour tokens adjusted so every text pair meets WCAG AA (4.5:1); a test reads the real CSS. This also fixed white-on-accent button text at 2.9:1 in dark.
- Status pill uses theme tokens instead of fixed pale colours that were unreadable on light.
- Page title is now `minidash`.
### Added
- Production-grade documentation: architecture with diagrams, configuration, operations, troubleshooting, security model, development guide, and decision records 0002 to 0008.
- README with a banner, a dashboard layout illustration (clearly labelled, made-up values), badges, requirements, performance table and a quick start.
- Community files: contributing guide, security policy, code of conduct, issue templates, CODEOWNERS and Dependabot configuration.

## [0.1.0] spec, implemented and deployed
First complete implementation of spec 0.1.0. Pending before it is marked `implemented`: a GPU-load check (AC-2) and a visual review in a browser.

### Added
- Go agent that samples the machine once a second and streams snapshots over an authenticated WebSocket (token as the first message, constant-time comparison, origin allow-list).
- Collectors: CPU, unified memory, SoC (GPU, power, temperatures, fans via `macmon`), disks (internal and external, per-disk throughput), network, processes, containers (Docker, Podman, Colima) and shares (mounts, offered shares, connected clients).
- React web UI with live charts, a summary strip, light and dark themes and a wall-display mode.
- JSON Schema contract shared by the agent and the UI, with generated TypeScript types.
- launchd installer for the agent and a hardened nginx container for the UI.
- Spec-driven workflow: versioned spec, plan and tasks; Claude rules, hooks and skills; git hooks; CI.

### Changed
- CPU budget: agent plus `macmon` measured at about 1.65% of one core on the Mac mini (budget 2%). Achieved by caching `vm_stat`, reading 64-bit network counters from a sysctl instead of forking `netstat`, looking up process names lazily, and throttling slow collectors. `macmon` samples every 2 s by default.

### Fixed
- Installer function shadowed `/usr/bin/install`, so a real install recursed (found while deploying; the dry run hid it).
- nginx dropped the security headers on every response, because location-level `add_header` discards server-level ones.
- Token form rendered as a black box with invisible text on the light theme; it now uses theme colours.
- Network byte counters wrapped at 4 GB when read from `NET_RT_IFLIST2`; replaced with the 64-bit `ifmib` sysctl.
- CI no longer fails on the spec template's own `[NEEDS INPUT]` instruction text, and macOS-only tests skip on Linux.
