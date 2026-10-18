# 15. Read per-process GPU time by forking `ioreg`

Status: accepted. Follows [ADR 0014](0014-per-process-gpu-time-without-root.md). Spec 0.6.0, plan DD-21.

## Context
ADR 0014 found that every GPU client in the IORegistry (class `AGXDeviceUserClient`) names its process in `IOUserClientCreator` (`pid N, name`) and carries `AppUsage[].accumulatedGPUTime`, a cumulative counter in nanoseconds, readable by a normal user. Spec 0.6.0 adds a per-process GPU column built on it. The agent has to read that data a few times a minute with these constraints:

- The release build is `CGO_ENABLED=0` (`deploy/make-release-assets.sh`, `deploy/upgrade.sh`).
- The agent must not crash or hang because of the source (DD-1), and a bad read must fail only the GPU values (FR-31).
- The CPU budget is 2% of one core for the agent plus `macmon` ([ADR 0006](0006-cpu-budget-and-throttling.md)).
- Everything parsed from outside is bounded and validated.

## Decision
Fork `/usr/sbin/ioreg -r -c AGXDeviceUserClient -l -a` and decode its XML plist output with `howett.net/plist`, which the disk collector already uses. The reader lives in `agent/internal/collect/gputime` behind a `Reader` interface.

- A 1 s timeout kills a slow `ioreg`. Stdout is read through a 4 MiB + 1 byte limit: more is an error, never a truncated parse, and the child is stopped rather than drained.
- Only `IOUserClientCreator` and `AppUsage[].accumulatedGPUTime` are decoded; other keys are ignored, so new keys in a later macOS do not break it.
- The creator must match `^pid (\d{1,6}), ` with a pid from 1 to 99999. Other clients are skipped and counted. If clients exist and none matches, the read fails with an error that names the macOS version, so a format change is visible in the card instead of reading as zero.
- More than 4096 clients, or a per-pid sum that overflows `uint64`, is an error.
- The process name in the creator is not used: macOS truncates it to 16 characters, and the process table already has the name for the pid.
- The read runs on its own interval (`MINIDASH_PROC_GPU_INTERVAL_MS`, a multiple of the 3 s process refresh, `0` = off), set from a measurement on the Mac mini (plan DD-24, `docs/collectors.md`).

## Consequences
- No cgo, no new dependency, no root.
- A crash or hang in the reader stays in a child process.
- Each read costs a fork and a walk of the whole registry: about 7.8 ms of CPU on the Mac mini (40 reads timed; about 18 ms on a dev M4 Pro). Most of it is `ioreg` itself, not the fork. This is why the interval is configurable.
- The format is pinned by sanitised fixtures recorded on the Mac mini (`agent/internal/collect/gputime/testdata`). When macOS changes it, record a new fixture.
- Time is credited to whichever process opened the client. `runningboardd` and `WindowServer` open clients on apps' behalf, so their time can belong to an app. The card and the docs say so (FR-33); there is no re-attribution.

## Rejected alternatives
- **`ioreg -l -w0` text output with a hand-written parser.** Same cost (measured), but an undocumented text grammar with nested `{}` and `()` and quoting that we would have to parse, bound and fuzz ourselves.
- **IOKit in process through `purego`** (already an indirect dependency via gopsutil). No fork and probably under 1 ms per read. But it needs CoreFoundation walking (CFDictionary, CFArray, CFNumber, CFString) and manual `CFRelease` through an FFI with no type checking. A wrong signature segfaults the whole agent, which `recover` cannot catch. It is also unverified that user clients can be reached by matching rather than by walking the accelerator's children. Kept as the fallback if the fork cost ever stops fitting the budget.
- **IOKit through cgo.** The release build is `CGO_ENABLED=0`, and cgo would bring a C toolchain into the build.
- **`powermetrics`.** Needs root.
- **A separate helper binary.** Another install and launchd unit for one read.
- **Activity Monitor's private frameworks.** Private API.
