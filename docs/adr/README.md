# Architecture decision records

Short, numbered, append-only. Supersede a decision with a new ADR rather than editing an old one. Spec-level choices live in `spec/<version>/plan.md`; an ADR records a decision whose reasoning outlives one spec version.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | accepted |
| [0002](0002-native-agent-containerised-ui.md) | Native agent, containerised UI | accepted |
| [0003](0003-macmon-for-gpu-and-power.md) | Use macmon for GPU, power and thermals | accepted |
| [0004](0004-websocket-first-message-auth.md) | WebSocket with first-message token auth | accepted |
| [0005](0005-kernel-counters-for-network.md) | Read network counters from the kernel ifmib sysctl | accepted |
| [0006](0006-cpu-budget-and-throttling.md) | CPU budget, throttling and lazy lookups | accepted |
| [0007](0007-contract-first-json-schema.md) | Contract-first JSON Schema shared by Go and TypeScript | accepted |
| [0008](0008-git-flow-and-merge-strategy.md) | Trunk-based git flow and merge strategy | superseded by 0013 |
| [0009](0009-browser-side-layout-and-theme.md) | Browser-side layout and theme state | accepted |
| [0010](0010-container-queries-and-width-resize.md) | Container queries and width-only resize | accepted |
| [0011](0011-squash-merge-and-labelled-releases.md) | Squash every PR, auto-label, release by tag | squash superseded by 0013; labels and releases accepted |
| [0012](0012-https-through-tailscale-serve.md) | HTTPS through Tailscale Serve | accepted |
| [0013](0013-git-flow-and-merge-commits.md) | Git Flow with merge commits, pre-1.0 versioning | accepted |
