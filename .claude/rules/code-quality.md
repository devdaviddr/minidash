# Code quality

- Typed contracts first: the snapshot schema is defined in spec/plan before code, and shared between agent and web (generated types, not hand-copied).
- Each collector sits behind an interface, fails independently, and has a fake for tests. One bad source must never blank the dashboard.
- Read-only: no code path may start, stop or modify processes, containers, mounts or settings.
- Functions do one thing; prefer early returns; no dead code, no commented-out code.
- Tests: unit tests for parsers using recorded fixtures (`macmon`, `smbutil`, Docker API); one test per acceptance criterion; no test depends on the host machine's real load.
- Lint and format must pass before commit (Go: gofmt, go vet, golangci-lint; web: oxlint, tsc -b). Zero warnings.
- UI: accessible (contrast, keyboard, reduced motion), light and dark themes, works from phone to wall display.
- Performance budget: agent under 2% of one core on average; UI renders at 1 Hz without dropped frames.
