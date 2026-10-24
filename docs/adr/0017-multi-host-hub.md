# 17. Watch several hosts through a hub agent

Status: accepted (spec 0.8.0, plan DD-27 to DD-29).

## Context
minidash watched one Mac mini. The owner now runs a second machine that matters as much, a Linux GPU box serving local LLMs, and wants minidash to grow into observability for several machines on the network: one machine collates the data and the page keeps today's look, with every host visible at once and each one in full. Linux comes first; Windows follows in a later release. The page is served by the Mac mini over the LAN and over Tailscale HTTPS on one origin (ADR 0016), and every agent is read-only behind a shared token (ADR 0004).

## Decision
- **The hub pulls.** One agent, the hub, reads a hosts file (mode 600) and opens a client WebSocket to each remote agent's existing `/ws` stream with that remote's token. It relays the snapshots to browsers that ask for `"hosts": "all"`, stores every host's history under `history/<host>/` and serves `/history?host=`. The browser keeps one origin and one token.
- **The hub is the Mac mini.** It is always on and already serves the UI and the tailnet HTTPS. The LLM box suspends when idle.
- **Hub is a mode, not a program.** Every machine runs the same `minidash-agent`; a hosts file turns the hub on.
- **Remotes are untrusted.** Messages are size-capped and decoded into typed structs, lists are bounded, and the host label comes from the hosts file, never from the remote.
- **Transport.** Tailnet addresses (WireGuard) are the documented default for remotes; LAN `ws://` is allowed, with the same unencrypted-token limit as today's LAN browser link.
- **NVIDIA through a long-running `nvidia-smi` child**, the pattern ADR 0003 uses for `macmon`, so the build stays `CGO_ENABLED=0`.
- **Sized for up to 8 hosts.** The hub's cost may grow by at most 0.3% of one core and 15 MB per remote.

## Consequences
- A remote needs no new endpoint and stays read-only; adding a host is one hosts-file entry on the hub.
- The hub holds every remote's token, so its hosts file is a secret: never in the repo, never logged, never sent.
- The page depends on the hub: if the Mac mini is down, so is the dashboard, even when remotes are up.
- A remote that suspends shows as "down" with gaps in its history; filling gaps from the remote's own history is 0.9.0.
- 0.7.0 pages keep working against a 0.8.0 hub (multi-host data is opt-in per client).

## Rejected alternatives
- **The browser connects to every agent:** every host's token in the browser, HTTPS and an allowed origin on every host, and history scattered across machines.
- **Agents push to a central server:** gives the hub a write endpoint and every agent a credential for it.
- **A separate hub program:** a second build, installer and security review for little gain.
- **NVML bindings:** need cgo. **One `nvidia-smi` fork per tick:** too costly for the budget.
