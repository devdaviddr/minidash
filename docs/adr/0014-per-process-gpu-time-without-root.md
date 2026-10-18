# 14. Per-process GPU time is readable without root

Status: accepted. Corrects one consequence of [ADR 0003](0003-macmon-for-gpu-and-power.md).

## Context
ADR 0003, the plans for specs up to 0.5.0, the README and the process card all said macOS does not expose per-process GPU use without root. That is wrong. Checked on the Mac mini (macOS 26, M4) as the normal login user: every GPU client in the IORegistry, class `AGXDeviceUserClient`, carries `IOUserClientCreator` (`pid N, name`) and an `AppUsage` list with `accumulatedGPUTime`, a counter of GPU time in nanoseconds. `ioreg -r -c AGXDeviceUserClient -l` prints them; 27 clients were listed at the time.

Limits seen: a client is attributed to the process that opened it, and some are opened on an app's behalf by `runningboardd` or `WindowServer`, so their time lands on those processes. The counter is cumulative, so a percentage needs two samples.

## Decision
- Stop saying it cannot be done. The docs and the UI now say per-process GPU use is not shown *yet*, and point here.
- ADR 0003 stands: `macmon` stays the source for system GPU, power and thermals.
- A per-process GPU column is new scope. It needs its own spec (the next MINOR) before any code, covering the sampling cost, attribution and units.

## Consequences
- No behaviour changes in this correction.
- The frozen spec plans keep the old risk note as history; the next spec's plan replaces it.

## Rejected alternatives
- **Edit ADR 0003 in place:** ADRs are append-only.
- **Leave the text until the feature is built:** the UI would keep telling users something false.
