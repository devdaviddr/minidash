# 7. Contract-first JSON Schema shared by Go and TypeScript

Status: accepted

## Context
The agent (Go) and the UI (TypeScript) exchange one message shape. Hand-copying types between languages drifts.

## Decision
`contracts/snapshot.schema.json` is the single source of truth. Every collector test marshals its output through the aggregator and validates the whole snapshot against the schema (`testutil.AssertMatchesContract`). The UI's types are generated from the schema (`npm run gen:types`) and never edited by hand.

## Consequences
- A shape change that breaks either side fails a Go test or the TypeScript build.
- Collector payloads use `additionalProperties: false`, so an accidental extra field is caught.
- Within a major spec version, changes are additive. Removing or reshaping a field is a MAJOR spec bump.
- Adding a collector means touching the schema first.

## Rejected alternatives
- **Hand-written duplicate types:** drift.
- **Generate Go and TypeScript from a third format (protobuf):** heavier tooling for a small, JSON-native stream.
