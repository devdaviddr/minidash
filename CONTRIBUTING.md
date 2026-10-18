# Contributing

Thanks for helping. minidash is small and opinionated: it is **spec-driven** and **trunk-based**. This page is the short version; [docs/development.md](docs/development.md) has the detail.

## Before you start
- Check [open issues](https://github.com/devdaviddr/minidash/issues) and the [spec](spec/1.2.0/spec.md). For anything bigger than a bug fix, open an issue first so the requirement and acceptance criteria can be agreed before code.
- Read the [code of conduct](CODE_OF_CONDUCT.md). Report security problems privately: [SECURITY.md](SECURITY.md).

## Set up
```sh
git clone https://github.com/devdaviddr/minidash && cd minidash
make setup        # git hooks and web dependencies
make check        # must pass before you push
```

## The workflow
1. **Spec first.** A change in behaviour starts as a change in `spec/` (requirement, acceptance criterion, task), with the spec version bumped for scope changes. Code follows an approved spec.
2. **Branch** from current `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `refactor/…` or `test/…`. Keep branches short-lived and do not stack them.
3. **Commit** with [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, 72 characters or fewer. In the body say why and cite the task and requirement (`Refs: T-3, FR-1, AC-1`). One logical change per commit. The git hooks enforce this.
4. **Test.** Every acceptance criterion needs an automated check, or a documented manual check when it needs real hardware. Keep fixtures free of real hostnames, IPs, share names and account names.
5. **Document.** Update the docs in the same commit as the behaviour. A decision with trade-offs gets an [ADR](docs/adr/README.md). Each collector is documented in [docs/collectors.md](docs/collectors.md).
6. **Open a pull request** into `main`. The title is a Conventional Commit. Fill in the template. CI (`governance`, `agent`, `web`) must be green.

## Rules that are enforced
- No commits or pushes directly to `main`; no `--no-verify`; no force-pushes to shared branches.
- No secrets, tokens, private hostnames or real machine data in the repo. It is public.
- The agent stays **read-only**: nothing may start, stop or modify processes, containers, mounts or settings.
- The whole monitor stays under 2% of one CPU core. Measure when you add a collector.
- Wire-format changes go through `contracts/snapshot.schema.json`; generated TypeScript types are never edited by hand.

## Good first contributions
- A new collector or a better data source (follow [Adding a collector](docs/development.md#adding-a-collector)).
- Fixes for macOS versions or hardware other than the M4 Mac mini, with a sanitised fixture.
- Documentation, troubleshooting entries, and screenshots.

## Reviews
Maintainers aim to respond within a few days. Small, focused pull requests merge fastest.
