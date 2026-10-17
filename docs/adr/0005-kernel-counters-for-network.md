# 5. Read network counters from the kernel ifmib sysctl

Status: accepted

## Context
Per-interface byte counters drive the network throughput view, and they are read every second. gopsutil's macOS implementation forks `netstat -ibdn` on each call. Profiling showed that single call cost more CPU than all other network work combined.

The obvious replacement, `NET_RT_IFLIST2` via `syscall.RouteRIB`, looked correct and passed unit tests. A cross-check against `netstat -ib` on a real interface exposed a bug: its byte counters are **32-bit** on current macOS and wrap at 4 GB. The packet counters matched; only bytes were wrong.

## Decision
Read each interface's 64-bit counters from the per-interface `net.link.generic.ifdata.<index>.1` sysctl (`struct ifmibdata`, which embeds `if_data64`) using `golang.org/x/sys/unix`. The interface list is cached for 5 seconds; counters are read every tick. Off macOS the code falls back to gopsutil so development and CI work on Linux.

## Consequences
- No process fork on the hot path.
- A struct-layout dependency on macOS. `TestKernelCountersAgreeWithNetstat` compares live values with `netstat -ib` on a busy interface, and a unit test covers 64-bit values above 2^32.

## Rejected alternatives
- **gopsutil as is:** forks `netstat` every second.
- **`NET_RT_IFLIST2`:** 32-bit byte counters, silently wrong above 4 GB.
- **Parsing `netstat` ourselves:** same fork cost.
