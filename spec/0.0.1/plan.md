---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 0.0.1
status: draft
updated: 2026-10-18
---

# minidash realtime Mac mini monitor — Implementation Plan

> **Stage 2 · PLAN** — select the tech and architecture. This is the *how* for the requirements in
> `spec.md` at this same version. Every decision here should trace back to an FR / NFR.
>
> **Don't assume the stack.** Ask the user about existing platform, datastore, framework, and
> constraints before choosing. Mark unknowns as `[NEEDS INPUT: question]`.

## 1. Approach summary
A small native agent on the Mac mini samples system metrics once a second and streams one JSON snapshot per tick over a WebSocket to a single-page web app. The agent also serves that app as static files, so deployment is one binary under launchd. Status: stack approved by owner 2026-10-18; spec approval pending (spec §9).

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

## 3. Architecture
collectors (cpu, gpu, mem, disk, net, procs, containers, shares) -> snapshot aggregator (1 Hz) -> WebSocket hub -> browser store -> chart/table components. Each collector sits behind a small interface so it can fail independently and be faked in tests.

## 4. Data & contracts
<!-- Concrete realisation of spec.md §7: schemas, API endpoints, message/event shapes, storage. Define typed contracts before coding. -->
```
```

## 5. Key decisions & trade-offs
<!-- The decisions a future reader would otherwise re-litigate. One line each: decision → rationale. -->
- **DD-1.** Collectors fail independently: one broken source never blanks the dashboard. (FR-6, FR-8)
- **DD-2.** Read-only agent, localhost bind by default. (NFR network exposure)
- **DD-4.** Deployment is container-based, but a container on macOS runs in a Linux VM and cannot see the host's CPU, GPU, memory, disks, shares or `macmon`. So the collecting agent is a small native process under launchd (host access, read-only), and the web UI plus its static server is the container. The container reaches the agent over the LAN with the shared token. Owner asked for "container"; this is the part that cannot be one. (FR-1..FR-9)
- **DD-5.** Access control is a shared token (config, constant-time compare, refuses to start without one), over LAN. (NFR network exposure)
- **DD-3.** Privileged data (e.g. powermetrics) is isolated in a separate optional helper, never in the main agent.

## 6. Risks & mitigations
<!-- What could go wrong technically, and the plan if it does. -->
- **Risk:** per-process GPU use is not exposed by macOS without root. **Mitigation:** show system GPU only; per-process GPU marked unavailable.
- **Risk:** `macmon` output format changes. **Mitigation:** parse behind an interface with a recorded-fixture test.

## 7. Rollout & observability
<!-- How it ships, how it's measured, how it's rolled back. Maps to NFRs. -->
-
