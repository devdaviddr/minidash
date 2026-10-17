# Collectors

Each collector is one entry in the snapshot's `collectors` map. A failure shows as `ok:false` with an `error` and never affects the others. Payload shapes are in [`contracts/snapshot.schema.json`](../contracts/snapshot.schema.json).

| Collector | Source | Units | Failure modes |
| --- | --- | --- | --- |
| `cpu` | gopsutil, delta since the previous tick | percent 0-100, load average | none expected |
| `memory` | gopsutil `VirtualMemory` + `SwapMemory`; `vm_stat` for the compressor | bytes. `used = active + wired + compressed` | `vm_stat` failing only zeroes `compressed` |
| `soc` | `macmon pipe` subprocess (no root) | percent, MHz, watts, °C, rpm | macmon missing or silent for 5 s: `ok:false` "macmon unavailable (install with: brew install macmon)" |

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
