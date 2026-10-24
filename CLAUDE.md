# minidash

Realtime monitoring dashboard for an M4 Mac mini: CPU, GPU, unified memory, disks (internal and external), network, processes, containers (Docker, Podman, Colima), shares and network accounts. Public repo: github.com/devdaviddr/minidash.

## Status
Spec 0.8.0 (multi-host: Linux agent, a hub on the Mac mini, fleet view; ADR 0017) is current and approved. Releases v0.1.0 to v0.7.x are published; the next release starts with `spec_tool.py bump minor` on `develop`. The project stays below 1.0.0: each release is a MINOR with its own spec directory, hotfixes are a PATCH, and the spec version equals the release version (ADR 0013). Deployment: native agent under launchd plus containerised web UI. Work tasks in the current `spec/<version>/tasks.md` order; scope changes go through the spec first (see `.claude/rules/sdd.md`).

## Where things are
- `spec/<version>/{spec,plan,tasks}.md`: the contract. Highest version is current. Older versions are frozen.
- `tools/sdd/`: vendored spec helper. `python3 -I tools/sdd/scripts/spec_tool.py list|show|bump`.
- `docs/`: user and developer docs. `docs/adr/`: architecture decision records.
- `.claude/rules/`: the rules below, one topic per file. Read them.
- `.claude/hooks/`: scripts that enforce the rules. `.githooks/`: git-level enforcement.

## Rules (summary; full text in `.claude/rules/`)
1. **Spec first.** Build only what an approved spec and task describe. Scope change means bump the spec version first.
2. **Git.** Git Flow (ADR 0013). Branch from `develop`, never commit to `main` or `develop`, Conventional Commits, one logical change per commit (branch commits are kept by merge commits, so keep them tidy), reference task IDs (`T-3`) in commits. PRs go into `develop`; merge one only when the owner asks. Never open or merge a PR into `main` yourself; release and hotfix PRs are the owner's, via the ship skill.
3. **Docs.** Any user-visible or architectural change updates docs in the same commit. Decisions with trade-offs get an ADR.
4. **Code.** Small functions, typed contracts, collectors behind interfaces, tests for every acceptance criterion. Read-only agent: nothing may change system or container state.
5. **Security.** No secrets in the repo (it is public). Agent is LAN-reachable only with a shared access token.

## Commands
`make setup` once after cloning (git hooks + web deps). `make check` runs gofmt, vet, tests, golangci-lint, oxlint and tsc. `make build` produces `bin/minidash-agent` and `web/dist/`. Run the agent: `MINIDASH_TOKEN=dev go run ./agent/cmd/minidash-agent`. Web tests: `cd web && npm test`. Deploy: `docs/deploy.md`.

## Working style
Ask before assuming. Unknowns go in the spec as `[NEEDS INPUT: ...]`, not guesses. Do not drive Chrome to test the UI; verify headlessly and let the owner review visuals.
