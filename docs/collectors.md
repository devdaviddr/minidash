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
