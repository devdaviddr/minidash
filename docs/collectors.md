# Collectors

Each collector is one entry in the snapshot's `collectors` map. A failure shows as `ok:false` with an `error` and never affects the others. Payload shapes are in [`contracts/snapshot.schema.json`](../contracts/snapshot.schema.json).

| Collector | Source | Units | Failure modes |
| --- | --- | --- | --- |
| `cpu` | gopsutil, delta since the previous tick | percent 0-100, load average | none expected |
| `memory` | gopsutil `VirtualMemory` + `SwapMemory`; `vm_stat` for the compressor | bytes. `used = active + wired + compressed` | `vm_stat` failing only zeroes `compressed` |
| `soc` | `macmon pipe` subprocess (no root), 2 s default | percent, MHz, watts, °C, rpm | macmon missing or silent for 5 s: `ok:false` "macmon unavailable (install with: brew install macmon)" |

## Notes
- **Used memory** follows Activity Monitor's idea of "memory pressure" (active + wired + compressed). Inactive pages are reclaimable and excluded.
- **GPU** utilisation in the GPU card is system-wide, from `macmon`. The process table's GPU column is per process; see [processes](#processes).
- **Manual check (AC-2)**: run a GPU-heavy app (a game, `ffmpeg` with VideoToolbox, a Metal benchmark) and watch GPU % and power rise on the dashboard. This cannot be automated headlessly.

## disks
- **Source:** gopsutil partitions, usage and I/O counters; `diskutil info -plist` (cached per device) for name, internal/external and the physical disk.
- **Listed:** the internal Data volume plus local filesystems under `/Volumes`. System volumes (VM, Preboot...) and network shares are excluded.
- **Throughput** is per physical disk, bytes/s, from counter deltas. The first tick, and any tick where a counter went backwards, reads 0. APFS volumes are joined to the physical disk behind their container, so two volumes on one SSD show the same figure.
- **Unknown devices** (diskutil failed) are shown as external and retried next tick.

## network
- **Source:** gopsutil interface list and per-interface byte counters.
- **Active interface** = up, not loopback, with an IPv4 address. This hides `awdl0`, `llw0` and IPv6-only tunnels.
- **Rates** are bytes/s from counter deltas. First tick and counter resets read 0. `rxBytes`/`txBytes` are cumulative since boot.

## processes
- **Source:** gopsutil process table. Per process: resident memory, user+system CPU time, thread count. Name and owner are looked up only for the processes that make the list, because those two calls cost about 80% of a full scan.
- **List:** union of the top 25 by CPU, the top 25 by resident memory and the top 25 by GPU % (above 0 only), so the browser can sort any way. `total` is every process the agent can read.
- **GPU** (`gpu`, 0.6.0) is percent of the whole GPU, 0-100: the change in a process's GPU time over the wall time between two GPU reads. GPU time is the sum of `AppUsage[].accumulatedGPUTime` (nanoseconds) over every GPU client the process opened, read without root by running `ioreg -r -c AGXDeviceUserClient -l -a` and decoding its plist ([ADR 0015](adr/0015-read-gpu-time-by-forking-ioreg.md)).
  - **Interval:** every 3 s by default, alongside the process refresh; `MINIDASH_PROC_GPU_INTERVAL_MS` sets a multiple of 3000, or `0` to turn it off. Between reads the last values are reused.
  - **`null` ("–")** before the second read, for a process new to the GPU or new since the last read, and for one whose GPU time went down (a client closed or the pid was reused; the next read measures from the new baseline). A process with no GPU clients reads 0. Values above 100 (overlapping work on several clients) are clamped to 100.
  - **Attribution:** time is credited to the process macOS names as the client's creator. `runningboardd` and `WindowServer` open clients on apps' behalf, so an app's GPU work can show on them. minidash does not re-attribute it.
  - **Failure modes:** `ioreg` failing, taking over 1 s (killed), printing over 4 MiB, listing over 4096 clients, malformed output, or a creator format no client matches (the message names the macOS version). Each makes every `gpu` `null` and sets `gpuError`, shown as "GPU unavailable: <reason>"; the list, CPU and memory are unaffected. Off (`0`) reports the same way.
  - **Fixtures:** `agent/internal/collect/gputime/testdata` holds two reads recorded on the Mac mini 3 s apart, sanitised (pids renumbered, app names replaced except system services, ids and unused keys dropped), plus synthetic edge cases.
- **CPU** is percent of one core (can exceed 100), from CPU-time deltas over real elapsed time.
- **Privacy:** executable name only. Command-line arguments are never collected, since they can contain secrets.
- **Refresh:** every 3 s (wrapped in `snapshot.Throttle`) to stay inside the CPU budget; the stream still ticks at 1 Hz and repeats the last result in between.
- Unreadable processes (other users', without root) are skipped.

## containers
- **Source:** the Docker Engine API over each runtime's unix socket. Docker, Podman and Colima all speak it.
- **Sockets tried** (first that exists wins, per runtime): Colima `~/.colima/*/docker.sock`; Podman `~/.local/share/containers/podman/machine/podman.sock`, `$TMPDIR/podman/*-api.sock`, `/var/run/podman/podman.sock`; Docker `/var/run/docker.sock`, `~/.docker/run/docker.sock`.
- **Colima and Podman are checked before Docker.** `/var/run/docker.sock` is often a symlink into Colima, so a socket already claimed (by resolved path) is skipped for later runtimes. Containers are never counted twice.
- **Status:** `running`; `not-running` (no socket, or connection refused: a normal state, no error text); `error` (the API answered badly).
- **Read-only:** only `GET` requests are made, and a test asserts it. Stats use `one-shot=true`; CPU and network rates come from deltas between ticks. Memory is usage minus reclaimable cache, like `docker stats`.
- **Refresh:** every 2 s, at most 100 containers per runtime.
- The agent must run as the user who owns the runtimes (a launchd LaunchAgent), so the per-user sockets are reachable.

## shares
- **Mounted shares:** parsed from `mount` output (SMB and NFS only; AFP is out of scope). Each has protocol, server, share, mount point, remote account, the local user who mounted it, reachability and capacity.
- **Capacity** comes from `statfs` with a 2 s timeout and at most one call in flight per mount, because a dead server can hang `statfs` forever. A timeout shows the share as `unreachable`.
- **Accounts, mounts:** the user in the SMB URL. Passwords are never read or kept. Apple ID style identifiers (`com.apple.idms.*`, which embed account UUIDs) are shown as "Apple ID".
- **Shared by this Mac:** shares with SMB enabled, from `sharing -l`. Folder paths are not reported.
- **Connected clients:** established inbound connections on TCP 445 (SMB) and 2049 (NFS) from `netstat -anv`. The account is the owner of the serving process (`ps`). When macOS serves the connection as root, the real user is not visible without privileges and the account is blank ("unknown account" in the UI).
- **Refresh:** every 10 s.

## CPU budget (NFR: under 2% of one core)
Measured on an M4-class Mac over 60 s with a client connected: agent about 0.8%, `macmon` about 0.55% (at its default 2 s interval), total about 1.4%. What got it there:
- `vm_stat` (compressed memory) is cached for 5 s instead of forking every tick.
- Network counters come from the kernel's 64-bit `ifmib` sysctl, not a forked `netstat`. (`NET_RT_IFLIST2` was rejected: its byte counters are 32-bit and wrap at 4 GB. A test cross-checks against `netstat -ib`.)
- Process handles are built from PIDs directly, skipping one start-time sysctl per process. Processes refresh every 3 s, containers every 2 s, shares every 10 s.
- `macmon` samples every 2 s by default. Set `MINIDASH_SOC_INTERVAL_MS=1000` for 1 s GPU/power updates; that costs about 0.7% more.

### Per-process GPU (spec 0.6.0, T-37, AC-35)
Measured on the Mac mini (M4, macOS 26.4, about 690 processes) on 2026-10-18: a test build of the agent on a spare loopback port with one WebSocket client, agent CPU including its exited `ioreg` children (`ps -S`) plus its `macmon` child, over 60 s after a 15 s warm-up. The installed service kept running alongside.

| `MINIDASH_PROC_GPU_INTERVAL_MS` | Agent | `macmon` | Total |
| --- | --- | --- | --- |
| `0` (off, the "before" figure) | 1.08% | 0.38% | 1.47% |
| `3000` | 1.26%, 1.32% | 0.38% | 1.64%, 1.70% |
| `6000` | 1.25%, 1.22% | 0.38% | 1.63%, 1.58% |
| `9000` | 1.18%, 1.18% | 0.38% | 1.57%, 1.55% |

Second figures are a repeat run in reverse order; the repeat at `0` was cut short. One `ioreg` read costs about 7.8 ms of CPU on the mini, about 0.26% of a core at 3 s, which matches the difference. 3 s fits under the 1.9% threshold of plan DD-24, so the default is `3000`.

### Log retention (spec 0.7.0, T-49)
Measured on the Mac mini (M4, macOS 26.4) on 2026-10-18: a test build of the 0.7.0 agent on a spare loopback port with retention set to the maximum (`MINIDASH_RETENTION=28d`) and per-process GPU on at 3 s, over 60 s after a 15 s warm-up. The agent averaged **0.0–0.2% of one core** and about **23 MB RSS**. Compaction runs on a 1-minute cadence rather than every tick, so storing and downsampling history adds no measurable per-tick CPU and stays well under the 2% budget.
