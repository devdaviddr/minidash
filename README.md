# minidash

Realtime dashboard for an M4 Mac mini: CPU (per core), GPU, unified memory, power and temperatures, internal and external disks, network, processes, containers (Docker, Podman, Colima), mounted shares and connected network accounts. One page, updated every second.

**Status:** all eleven tasks of spec 0.1.0 are implemented. Automated tests pass; the remaining checks need the real Mac mini and a visual review (see [docs/deploy.md](docs/deploy.md#manual-acceptance-checks-need-the-real-mini)).

## How it works
A small Go agent runs natively on the Mac mini (launchd), samples the machine and pushes one JSON snapshot per second over an authenticated WebSocket. A React + TypeScript + Tailwind page, served from a container, draws it with uPlot.

```
collectors (cpu, memory, soc, disks, network, processes, containers, shares)
  -> aggregator (1 Hz) -> WebSocket hub (token auth) -> browser -> cards and charts
```

- Wire format: [`contracts/snapshot.schema.json`](contracts/snapshot.schema.json). Go output is validated against it in tests and the web types are generated from it.
- Each collector fails on its own; one broken source never blanks the page. Details: [docs/collectors.md](docs/collectors.md).
- Read-only: nothing here changes system or container state.
- Cost: about 1.4% of one CPU core in total on an M4-class Mac (agent plus `macmon`).

## Install
See [docs/deploy.md](docs/deploy.md). In short: `brew install macmon`, `deploy/install-agent.sh install`, then `docker compose -f deploy/compose.yaml up -d --build`.

## Develop
```sh
make setup      # git hooks + web deps
make check      # gofmt, vet, tests, golangci-lint, oxlint, tsc
MINIDASH_TOKEN=dev go run ./agent/cmd/minidash-agent   # agent on :8787
cd web && npm run dev                                   # UI with hot reload
node tools/probe.mjs ws://127.0.0.1:8787/ws 1           # print a snapshot
```
The project is spec-driven: read [CONTRIBUTING.md](CONTRIBUTING.md) and `spec/0.1.0/`.

## Limits worth knowing
- GPU use is system-wide; macOS does not expose per-process GPU use without root.
- Connected-client account names can be blank: macOS may serve SMB sessions as root, and the real user is then not visible without privileges.
- Only SMB and NFS shares are covered (AFP is out of scope).

## License
MIT
