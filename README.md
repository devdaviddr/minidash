# minidash

Realtime dashboard for an M4 Mac mini: CPU, GPU, unified memory, internal and external disks, network, processes, containers (Docker, Podman, Colima), shares and network accounts.

**Status:** specification phase. No runnable code yet. The draft spec is in [`spec/`](spec/).

## Planned stack (approved; spec approval pending)
Go agent sampling at 1 Hz and streaming over WebSocket to a React + Vite + TypeScript + Tailwind single-page app, charted with uPlot. Details and alternatives: [`spec/0.0.1/plan.md`](spec/0.0.1/plan.md).

## Development
Spec-driven: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT
