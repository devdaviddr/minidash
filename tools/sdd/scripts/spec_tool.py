#!/usr/bin/env python3
"""
spec_tool.py — deterministic helper for Dan's Spec Driven Development.

Manages semantically-versioned specs where **each version is its own directory**:

    spec/
      0.1.0/
        spec.md     # Stage 1 SPECIFY  — source of truth (what / why)
        plan.md     # Stage 2 PLAN     — tech & architecture (how)
        tasks.md    # Stage 3 TASKS    — ordered, testable backlog (do)
      1.0.0/
        spec.md
        plan.md
        tasks.md

`bump` snapshots: it copies the current (highest) version directory into a new
version directory, updates the frontmatter version + status, and appends a
changelog row to spec.md. The old directory is left frozen as history, so
`spec/<version>/...` is an immutable record you can diff across versions.

Pure standard library. See references/versioning.md for the bump rules.

Subcommands:
    init  [--title "..."] [--owner "..."] [--feature slug] [--root spec]
    bump  <major|minor|patch> --note "..." [--status ...] [--root spec]
    show  [version] [--root spec]
    list  [--root spec]
"""

from __future__ import annotations

import argparse
import datetime as _dt
import re
import sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
ARTIFACTS = ("spec.md", "plan.md", "tasks.md")
TEMPLATES = {"spec.md": "spec-template.md", "plan.md": "plan-template.md", "tasks.md": "tasks-template.md"}
FM_FENCE = "---"


def _today() -> str:
    return _dt.date.today().isoformat()


def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.strip().lower())
    return re.sub(r"-{2,}", "-", text).strip("-")


# --- frontmatter (flat, controlled key: value) --------------------------------


def read_frontmatter(content: str) -> tuple[dict, str]:
    lines = content.splitlines()
    if not lines or lines[0].strip() != FM_FENCE:
        return {}, content
    fm: dict[str, str] = {}
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == FM_FENCE:
            end = i
            break
        if ":" in lines[i]:
            k, _, v = lines[i].partition(":")
            fm[k.strip()] = v.strip()
    if end is None:
        return {}, content
    return fm, "\n".join(lines[end + 1 :])


def render_frontmatter(fm: dict) -> str:
    order = ["feature", "title", "version", "status", "owner", "created", "updated"]
    keys = [k for k in order if k in fm] + [k for k in fm if k not in order]
    return "\n".join([FM_FENCE] + [f"{k}: {fm[k]}" for k in keys] + [FM_FENCE])


def set_frontmatter(content: str, **updates) -> str:
    fm, body = read_frontmatter(content)
    fm.update({k: v for k, v in updates.items() if v is not None})
    sep = "" if body.startswith("\n") else "\n"
    return render_frontmatter(fm) + sep + body


# --- semver -------------------------------------------------------------------


def parse_version(v: str):
    m = re.match(r"^\s*v?(\d+)\.(\d+)\.(\d+)\s*$", v or "")
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def bump_version(v: str, level: str) -> str:
    major, minor, patch = parse_version(v)
    if level == "major":
        return f"{major + 1}.0.0"
    if level == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def version_dirs(root: Path):
    """Return [(tuple, dirname)] for version dirs containing spec.md, ascending."""
    if not root.exists():
        return []
    out = []
    for child in root.iterdir():
        if child.is_dir() and (child / "spec.md").exists():
            t = parse_version(child.name)
            if t:
                out.append((t, child.name))
    return sorted(out)


def current_dir(root: Path) -> Path | None:
    vs = version_dirs(root)
    return root / vs[-1][1] if vs else None


# --- changelog (newest on top, under the table separator) ---------------------


def add_changelog(content: str, version: str, level: str, note: str) -> str:
    fm, body = read_frontmatter(content)
    row = f"| {version} | {_today()} | {level} | {note} |"
    if "## Changelog" in body:
        lines, out, inserted, in_cl = body.splitlines(), [], False, False
        for line in lines:
            out.append(line)
            if line.strip().startswith("## Changelog"):
                in_cl = True
            elif in_cl and not inserted and re.match(r"^\|\s*-+", line):
                out.append(row)
                inserted = True
        if not inserted:
            out += ["", row]
        body = "\n".join(out)
    else:
        body = body.rstrip() + (
            "\n\n## Changelog\n\n| Version | Date | Level | Note |\n| --- | --- | --- | --- |\n" + row + "\n"
        )
    sep = "" if body.startswith("\n") else "\n"
    return render_frontmatter(fm) + sep + body


# --- commands -----------------------------------------------------------------


def cmd_init(args) -> int:
    root = Path(args.root)
    if version_dirs(root):
        cur = current_dir(root).name
        print(f"ERROR: {root} already has version(s) (current {cur}). Use `bump` instead.", file=sys.stderr)
        return 1
    feature = slugify(args.feature) if args.feature else slugify(args.title or root.name or "spec")
    title = args.title or feature.replace("-", " ").title()
    owner = args.owner or "TBD"
    today = _today()
    dest = root / "0.1.0"
    dest.mkdir(parents=True, exist_ok=True)
    for artifact, tmpl in TEMPLATES.items():
        text = (ASSETS / tmpl).read_text()
        text = (
            text.replace("{{FEATURE}}", feature)
            .replace("{{TITLE}}", title)
            .replace("{{VERSION}}", "0.1.0")
            .replace("{{STATUS}}", "draft")
            .replace("{{OWNER}}", owner)
            .replace("{{CREATED}}", today)
            .replace("{{UPDATED}}", today)
        )
        (dest / artifact).write_text(text)
    print(f"Created {dest}/ at 0.1.0 (draft) with: {', '.join(ARTIFACTS)}")
    print("  Next: fill spec.md → plan.md → tasks.md, review, then `bump major --status approved` to reach 1.0.0.")
    return 0


def cmd_bump(args) -> int:
    root = Path(args.root)
    src = current_dir(root)
    if src is None:
        print(f"ERROR: no spec under {root}. Run `init` first.", file=sys.stderr)
        return 1
    fm, _ = read_frontmatter((src / "spec.md").read_text())
    old = fm.get("version") or src.name
    new = bump_version(old, args.level)
    dest = root / new
    if dest.exists():
        print(f"ERROR: {dest} already exists.", file=sys.stderr)
        return 1
    dest.mkdir(parents=True)
    for artifact in ARTIFACTS:
        sp = src / artifact
        if not sp.exists():
            continue
        text = set_frontmatter(sp.read_text(), version=new, updated=_today(), status=args.status)
        if artifact == "spec.md":
            text = add_changelog(text, new, args.level, args.note)
        (dest / artifact).write_text(text)
    print(f"{old} -> {new} ({args.level})   dir: {dest}/")
    if args.status:
        print(f"  status: {args.status}")
    print(f"  changelog: {args.note}")
    print(f"  (snapshot of {src.name} copied; {src.name} is now frozen history)")
    return 0


def cmd_show(args) -> int:
    root = Path(args.root)
    d = (root / args.version) if args.version else current_dir(root)
    if d is None or not (d / "spec.md").exists():
        print(f"ERROR: no spec.md at {d}", file=sys.stderr)
        return 1
    fm, _ = read_frontmatter((d / "spec.md").read_text())
    for k in ("feature", "title", "version", "status", "owner", "created", "updated"):
        if k in fm:
            print(f"{k:>8}: {fm[k]}")
    present = [a for a in ARTIFACTS if (d / a).exists()]
    print(f"{'dir':>8}: {d}/")
    print(f"{'files':>8}: {', '.join(present)}")
    return 0


def cmd_list(args) -> int:
    root = Path(args.root)
    vs = version_dirs(root)
    if not vs:
        print(f"(no versions under {root})")
        return 0
    print("VERSION   STATUS        FILES")
    for _, name in vs:
        fm, _ = read_frontmatter((root / name / "spec.md").read_text())
        files = ",".join(a.split(".")[0] for a in ARTIFACTS if (root / name / a).exists())
        marker = "  <- current" if name == vs[-1][1] else ""
        print(f"{name:<8}  {fm.get('status','?'):<12}  {files}{marker}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Dan's Spec Driven Development helper")
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("init", help="scaffold spec/0.1.0/{spec,plan,tasks}.md")
    pi.add_argument("--title")
    pi.add_argument("--owner")
    pi.add_argument("--feature")
    pi.add_argument("--root", default="spec")
    pi.set_defaults(func=cmd_init)

    pb = sub.add_parser("bump", help="snapshot current version into a new version dir")
    pb.add_argument("level", choices=["major", "minor", "patch"])
    pb.add_argument("--note", required=True)
    pb.add_argument("--status", choices=["draft", "approved", "implemented", "deprecated"])
    pb.add_argument("--root", default="spec")
    pb.set_defaults(func=cmd_bump)

    ps = sub.add_parser("show", help="show a version's metadata (default: current)")
    ps.add_argument("version", nargs="?")
    ps.add_argument("--root", default="spec")
    ps.set_defaults(func=cmd_show)

    pl = sub.add_parser("list", help="list all versions")
    pl.add_argument("--root", default="spec")
    pl.set_defaults(func=cmd_list)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
