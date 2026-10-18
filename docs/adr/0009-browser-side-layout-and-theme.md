# 9. Browser-side layout and theme state

Status: accepted

## Context
Version 1.1.0 lets the viewer choose a theme and customise the dashboard: show or hide cards and details, reorder, and resize. That state has to live somewhere. The agent is deliberately read-only.

## Decision
- **Store layout and theme in the browser** (`localStorage`: `minidash.layout`, `minidash.theme`). Move a layout between browsers with JSON export and import.
- **Model it as pure code.** A catalogue of cards and parts is the single source of truth; a validator repairs or refuses untrusted input; a reducer applies actions. The UI is a thin layer over them.
- **Apply the theme before paint** with a small same-origin script (`theme-init.js`) that sets `data-theme` on `<html>`. System (no attribute) follows the OS through a CSS media query.
- **Use dnd-kit** for drag and drop, with explicit move earlier/later buttons as the guaranteed accessible route.
- **Wall mode stays a display-time filter** and never writes to the saved layout.

## Consequences
- The agent gains no endpoints and no state, and a layout never leaves the browser.
- A viewer sets up each browser once, or imports a file. There is no automatic sync.
- A test compares the catalogue with the real components, so the customise panel cannot offer a detail that does not exist.
- Stored layouts carry `version: 1`, so a future incompatible change can detect and migrate them. Cards added later appear automatically.
- The CSP forbids inline scripts, so the theme script is a separate file served by the container.
- Cost: about 20 kB gzipped of JavaScript (dnd-kit and the layout code), inside the 40 kB budget.

## Rejected alternatives
- **Agent-side storage:** shared across devices, but the agent would write files and expose a write endpoint, which breaks the read-only design and widens the attack surface.
- **A state library (Zustand, Redux):** a dependency for one small state tree.
- **Native HTML5 drag and drop:** no touch support and weak keyboard support.
- **An inline theme script:** blocked by the container's Content-Security-Policy.
- **Theme in React state only:** the page would flash the wrong theme on load.
- **Hand-rolled validation with a schema library (ajv, zod):** a dependency for one type with a handful of documented repair rules.
