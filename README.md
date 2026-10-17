# minidash

Realtime dashboard for an M4 Mac mini: CPU, GPU, unified memory, internal and external disks, network, processes, containers (Docker, Podman, Colima), shares and network accounts.

**Status:** spec 0.1.0 approved; implementation starting. No runnable code yet. The spec is in [`spec/`](spec/).

## Planned stack (approved; spec 0.1.0 approved)
Go agent sampling at 1 Hz and streaming over WebSocket to a React + Vite + TypeScript + Tailwind single-page app, charted with uPlot. Details and alternatives: [`spec/0.0.1/plan.md`](spec/0.0.1/plan.md).

## Development
Spec-driven: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT
