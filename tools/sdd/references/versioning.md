# Spec versioning rules

Specs are versioned by **directory**: `spec/<version>/{spec.md, plan.md, tasks.md}`. Each version
directory is an **immutable snapshot** of that version's contract. `bump` copies the current
(highest) version into a new directory, updates the version + status, and appends a changelog row to
`spec.md`. The previous directory is left frozen, so you keep a diffable history of how the spec,
plan, and tasks evolved.

The version describes the **spec contract**, not the code. Always bump with the helper so the math,
the three artifacts, and the changelog stay consistent:

```bash
python3 scripts/spec_tool.py bump <major|minor|patch> --note "what changed" [--status approved]
```

## The lifecycle

| Version range | Meaning | `status` |
| --- | --- | --- |
| `0.y.z` | Draft. Being shaped, not yet a commitment. `init` creates `spec/0.1.0/`. | `draft` |
| `1.0.0` | First approved spec. Contract frozen enough to build against. | `approved` |
| `≥1.0.0` | Living contract; new snapshot per the rules below as it evolves. | `approved` → `implemented` |

You edit `spec.md`/`plan.md`/`tasks.md` **in place inside the current (highest) directory** while
shaping that version. `bump` is the act of freezing it and starting the next version. Promote
`0.x` → `1.0.0` only when the user explicitly approves and "Open questions" is empty (or deferred).

## What each level means (once at 1.0.0+)

Treat the spec as a contract that code and tests depend on.

- **MAJOR** (`2.0.0`) — a **breaking** change to something already specified and built: removing or
  reversing a functional requirement, changing the shape of a data/API contract, redefining an
  acceptance criterion so existing behaviour would fail. Requires re-approval.
- **MINOR** (`1.1.0`) — **additive, backward-compatible**: a new FR, new acceptance criterion, new
  scenario, an added optional field. Nothing previously specified breaks.
- **PATCH** (`1.0.1`) — **no behavioural change**: clarifying wording, fixing a typo, tightening an
  ambiguous sentence, correcting a cross-reference.

## Pre-1.0 (`0.y.z`)

While drafting, semver is looser because nothing is committed:
- **MINOR** (`0.2.0`) — meaningful additions or restructuring during drafting.
- **PATCH** (`0.1.1`) — small wording fixes during drafting.

## Deciding the level — quick test

Ask: *"If someone had already built to the previous version, what happens?"*
- Their code/tests would now be **wrong** → **MAJOR**.
- Their code still works, there's just **more** to build → **MINOR**.
- Their code is **unaffected**; only humans read the difference → **PATCH**.

## Every bump

1. Creates the new `spec/<new-version>/` snapshot (the helper copies all three artifacts).
2. Updates `version` + `updated` (and `status` if given) in each artifact's frontmatter.
3. Adds a `## Changelog` row in `spec.md` describing the change.
4. For MAJOR bumps, confirm re-approval with the user before continuing implementation.
