# Documentation

- README: what it is, screenshot, install, run, configure. Must be accurate at every commit.
- Update docs in the same commit as the change that makes them stale.
- Non-obvious decisions get an ADR in `docs/adr/NNNN-title.md` (context, decision, consequences, rejected alternatives). ADRs are append-only; supersede rather than edit.
- Code comments explain why, not what. Public functions and exported types have a one-line doc comment.
- Write plainly. No marketing language, no filler.
- Every collector documents its data source, units, sampling rate and failure modes in `docs/collectors.md`.
