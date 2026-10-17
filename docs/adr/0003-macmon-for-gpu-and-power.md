# 3. Use macmon for GPU, power and thermals

Status: accepted

## Context
macOS exposes Apple Silicon GPU utilisation, power draw, die temperatures and fan speeds through private IOReport and SMC interfaces. The documented command, `powermetrics`, needs root.

## Decision
Run [`macmon`](https://github.com/vladkens/macmon) (`macmon pipe`) as a child process and parse its JSON lines. A small runner keeps the newest sample; a sample older than 5 seconds counts as missing. If macmon is absent, only the `soc` collector reports `ok:false` with an install hint. The agent restarts macmon 5 seconds after it exits.

## Consequences
- No root and no privileged helper. This keeps the agent's trust level low.
- A dependency on a third-party binary and its output format. A recorded real sample is parsed in tests to catch format changes.
- macmon costs about 1.3% of one core at a 1 second interval, so the default is 2 seconds (see [ADR 0006](0006-cpu-budget-and-throttling.md)). `MINIDASH_SOC_INTERVAL_MS` trades freshness for CPU.
- Per-process GPU use is not available without root and is not shown.

## Rejected alternatives
- **`powermetrics`:** requires root and a privileged helper.
- **IOKit/IOReport via cgo:** reimplements what macmon already does, with a build-time C dependency.
- **Omit GPU:** GPU was an explicit requirement.
