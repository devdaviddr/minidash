---
feature: minidash-realtime-mac-mini-monitor
title: minidash realtime Mac mini monitor
version: 0.0.1
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

## 2. Goals
<!-- Success as outcomes. -->
- See CPU, GPU, unified memory, disk and network activity update live (about once a second).
- See which processes are using those resources.
- See container usage across Docker, Podman and Colima in one view.
- See mounted shares, network accounts and external drives and their health.
- A modern, polished UI that is pleasant to leave open on a wall display or second monitor.

## 3. Non-goals
<!-- Out of scope for this version. -->
- Long-term metric storage and alerting (live view only until a later version).
- Monitoring machines other than the Mac mini.
- Controlling the machine or containers (read-only dashboard).

## 4. User scenarios
<!-- "As a <role>, I want <capability> so that <outcome>." -->
- As the homelab owner, I want live CPU/GPU/memory graphs, so that I can see load as it happens.
- As the homelab owner, I want a process list sorted by CPU, GPU or memory, so that I can find what is using resources.
- As the homelab owner, I want one view of Docker, Podman and Colima containers, so that I do not check three CLIs.
- As the homelab owner, I want to see mounted shares and the external drive, so that I notice when one disappears or fills up.

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

## 6. Non-functional requirements
<!-- Performance, security, privacy, accessibility, compliance, observability. Specific and measurable. -->
- Sampling overhead: the monitor itself stays under 2% of one core on average.
- Read-only: no endpoint changes system or container state.
- Network exposure: reachable on the LAN. Every request and the WebSocket MUST present a shared access token set in configuration; the default config without a token refuses to start. The service never listens on a public interface.
- UI: usable at phone, desktop and wall-display sizes; light and dark themes.

## 7. Data model & contracts
<!-- Typed contracts BEFORE implementation: entities, fields, API shapes, events. The interface code must honour. -->
Defined in the plan once the stack is approved (typed metric snapshot schema, one stream message per tick).
```
```

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

## 9. Open questions
<!-- Unresolved decisions blocking approval. An approved spec has none (or each is deferred with an owner). -->
Resolved 2026-10-18 by owner: LAN exposure with shared token; network accounts = both; `macmon` helper acceptable; stack in plan.md §2 approved; deployment is containerised (see plan DD-4).

Also resolved (owner delegated to recommendation): share types are SMB and NFS only; overhead target is 2% of one core.

No open questions.

## Changelog

| Version | Date | Level | Note |
| --- | --- | --- | --- |
| 0.0.1 | 2026-10-18 | init | Initial draft |
