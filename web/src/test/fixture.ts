import type { Snapshot } from '../contract/snapshot'

const GB = 1024 ** 3

/** A complete, healthy snapshot with invented values, for component tests. */
export function fixture(over: Partial<Snapshot['collectors']> = {}, seq = 1): Snapshot {
  return {
    schema: 1,
    seq,
    ts: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    intervalMs: 1000,
    collectors: {
      cpu: { ok: true, data: { total: 42, cores: [10, 90, 30, 40], load: { one: 1.5, five: 1.2, fifteen: 1 } } },
      memory: {
        ok: true,
        data: { total: 16 * GB, used: 8 * GB, available: 6 * GB, wired: 2 * GB, active: 5 * GB, inactive: 3 * GB, compressed: 1 * GB, swapUsed: GB, swapTotal: 2 * GB },
      },
      soc: {
        ok: true,
        data: {
          gpu: { usage: 25, freqMhz: 900 },
          clusters: [{ label: 'P', usage: 50, freqMhz: 3200 }],
          power: { system: 12.5, cpu: 4, gpu: 1, ane: 0, ram: 0.5 },
          tempC: { cpu: 55, gpu: 50 },
          fans: [{ name: 'fan0', rpm: 1200, maxRpm: 7000 }],
        },
      },
      disks: {
        ok: true,
        data: {
          volumes: [
            { name: 'Macintosh HD', mount: '/System/Volumes/Data', fsType: 'apfs', total: 500 * GB, used: 200 * GB, free: 300 * GB, external: false, device: 'disk0' },
            { name: 'Backup', mount: '/Volumes/Backup', fsType: 'exfat', total: 1000 * GB, used: 950 * GB, free: 50 * GB, external: true, device: 'disk4' },
          ],
          devices: [
            { name: 'disk0', readBps: 1e6, writeBps: 2e6 },
            { name: 'disk4', readBps: 0, writeBps: 5e5 },
          ],
        },
      },
      network: {
        ok: true,
        data: {
          interfaces: [{ name: 'en0', ipv4: ['192.0.2.10'], rxBps: 2e6, txBps: 1e6, rxBytes: 5 * GB, txBytes: 2 * GB }],
          total: { rxBps: 2e6, txBps: 1e6 },
        },
      },
      processes: {
        ok: true,
        data: {
          total: 300,
          list: [
            { pid: 1, name: 'alpha', user: 'u', cpu: 80, rss: 100 * 1024 ** 2, threads: 4 },
            { pid: 2, name: 'bravo', user: 'u', cpu: 10, rss: 4 * GB, threads: 8 },
            { pid: 3, name: 'charlie', user: 'u', cpu: 5, rss: 1 * GB, threads: 2 },
          ],
        },
      },
      containers: {
        ok: true,
        data: {
          runtimes: [
            { name: 'colima', status: 'running', containers: [{ id: 'abc', name: 'web', image: 'nginx:1', state: 'running', status: 'Up', cpu: 3, memUsed: 100 * 1024 ** 2, memLimit: GB, rxBps: 100, txBps: 50 }] },
            { name: 'podman', status: 'not-running', containers: [] },
            { name: 'docker', status: 'error', error: 'HTTP 500', containers: [] },
          ],
        },
      },
      shares: {
        ok: true,
        data: {
          mounts: [{ protocol: 'smb', server: 'NAS', share: 'Media', mount: '/Volumes/Media', account: 'alice', mountedBy: 'admin', reachable: true, total: 1000 * GB, used: 100 * GB, free: 900 * GB }],
          sharing: [{ name: 'Public', protocols: ['smb'] }],
          sessions: [{ protocol: 'smb', remote: '192.0.2.77', account: 'carol' }],
        },
      },
      ...over,
    },
  }
}
