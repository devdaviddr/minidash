# Collectors

Each collector is one entry in the snapshot's `collectors` map. A failure shows as `ok:false` with an `error` and never affects the others. Payload shapes are in [`contracts/snapshot.schema.json`](../contracts/snapshot.schema.json).

| Collector | Source | Units | Failure modes |
| --- | --- | --- | --- |
| `cpu` | gopsutil, delta since the previous tick | percent 0-100, load average | none expected |
| `memory` | gopsutil `VirtualMemory` + `SwapMemory`; `vm_stat` for the compressor | bytes. `used = active + wired + compressed` | `vm_stat` failing only zeroes `compressed` |
| `soc` | `macmon pipe` subprocess (no root), 2 s default | percent, MHz, watts, °C, rpm | macmon missing or silent for 5 s: `ok:false` "macmon unavailable (install with: brew install macmon)" |

## Notes
- **Used memory** follows Activity Monitor's idea of "memory pressure" (active + wired + compressed). Inactive pages are reclaimable and excluded.
- **GPU** utilisation is system-wide. macOS does not expose per-process GPU use without root, so the process table has no GPU column.
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
- **List:** union of the top 25 by CPU and the top 25 by resident memory, so the browser can sort either way. `total` is every process the agent can read.
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
