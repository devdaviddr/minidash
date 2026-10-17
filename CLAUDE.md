# minidash

Realtime monitoring dashboard for an M4 Mac mini: CPU, GPU, unified memory, disks (internal and external), network, processes, containers (Docker, Podman, Colima), shares and network accounts. Public repo: github.com/devdaviddr/minidash.

## Status
Pre-implementation. The spec lives in `spec/` and is a draft with two items left to confirm. Deployment: native agent under launchd plus containerised web UI (plan DD-4). **No application code until the spec is approved** (see `.claude/rules/sdd.md`).

## Where things are
- `spec/<version>/{spec,plan,tasks}.md`: the contract. Highest version is current. Older versions are frozen.
- `tools/sdd/`: vendored spec helper. `python3 -I tools/sdd/scripts/spec_tool.py list|show|bump`.
- `docs/`: user and developer docs. `docs/adr/`: architecture decision records.
- `.claude/rules/`: the rules below, one topic per file. Read them.
- `.claude/hooks/`: scripts that enforce the rules. `.githooks/`: git-level enforcement.

## Rules (summary; full text in `.claude/rules/`)
1. **Spec first.** Build only what an approved spec and task describe. Scope change means bump the spec version first.
2. **Git.** Branch from `main`, never commit to `main`, Conventional Commits, one logical change per commit, reference task IDs (`T-3`) in commits. Never open or merge a PR into `main` yourself; the owner does that with the ship skill.
3. **Docs.** Any user-visible or architectural change updates docs in the same commit. Decisions with trade-offs get an ADR.
4. **Code.** Small functions, typed contracts, collectors behind interfaces, tests for every acceptance criterion. Read-only agent: nothing may change system or container state.
5. **Security.** No secrets in the repo (it is public). Agent is LAN-reachable only with a shared access token.

## Commands
Filled in as the toolchain lands (T-1). Until then: `git config core.hooksPath .githooks` once after cloning.

## Working style
Ask before assuming. Unknowns go in the spec as `[NEEDS INPUT: ...]`, not guesses. Do not drive Chrome to test the UI; verify headlessly and let the owner review visuals.
