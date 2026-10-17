# 6. CPU budget, throttling and lazy lookups

Status: accepted

## Context
The spec requires the monitor to stay under 2% of one core on average, including `macmon`. A first, straightforward build measured about 3%. Profiling found the cost was concentrated in forked commands and per-process system calls, not in the Go code.

## Decision
- **Fork less.** `vm_stat` (compressed memory) is cached for 5 seconds. Network counters come from a sysctl ([ADR 0005](0005-kernel-counters-for-network.md)).
- **Look up lazily.** The process scan reads cheap fields (memory, CPU time, threads) for every process. The costly name and owner lookups run only for the roughly 50 processes that make the list. Process handles are built from PIDs directly, skipping a start-time lookup per process.
- **Throttle slow collectors.** A generic wrapper (`snapshot.Throttle`) runs a collector at most once per interval and serves the previous result between runs: processes every 3 s, containers every 2 s, shares every 10 s. The stream stays at 1 Hz and rates stay correct because they use real elapsed time.
- **Sample `macmon` every 2 s** by default.

## Consequences
Measured on the Mac mini (693 processes, 14 containers): agent about 1.3%, macmon about 0.35%, total about 1.65%. GPU and power update every 2 s unless `MINIDASH_SOC_INTERVAL_MS=1000` is set, which costs roughly 0.7% more.

## Rejected alternatives
- **Cache everything at one global interval:** makes CPU, memory and network graphs choppy for no good reason.
- **Raise the budget:** the budget was a stated requirement.
