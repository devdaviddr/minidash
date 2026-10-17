# 1. Record architecture decisions

Status: accepted

## Context
Stack and design choices for minidash will be questioned later, by others and by us.

## Decision
Keep short ADRs in `docs/adr/`, numbered, append-only. Spec-level choices live in `spec/<version>/plan.md`; an ADR records a decision whose reasoning outlives one spec version.

## Consequences
A small cost per decision. A superseded decision is marked as such rather than deleted.
