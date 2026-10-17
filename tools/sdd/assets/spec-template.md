---
feature: {{FEATURE}}
title: {{TITLE}}
version: {{VERSION}}
status: {{STATUS}}
owner: {{OWNER}}
created: {{CREATED}}
updated: {{UPDATED}}
---

# {{TITLE}} — Specification

> **Stage 1 · SPECIFY** — capture the problem and scope. This file is the source of truth for
> *what* and *why*. The *how* lives in `plan.md`; the *do* lives in `tasks.md`.
>
> **Don't guess.** Ask the user for anything you can't state confidently. If a value is still
> unknown, write `[NEEDS INPUT: question]` here and add it to §9 Open questions — never invent it.

## 1. Problem & context
<!-- WHY this exists. The problem and who has it. No solution detail. -->

## 2. Goals
<!-- Success as outcomes. A few sharp bullets. -->
-

## 3. Non-goals
<!-- Explicitly out of scope for this version. Protects the version contract from scope creep. -->
-

## 4. User scenarios
<!-- "As a <role>, I want <capability> so that <outcome>." -->
- As a , I want , so that .

## 5. Functional requirements
<!-- Numbered, testable, implementation-agnostic. FR-N is a contract line referenced by tasks, tests, and version bumps. -->
- **FR-1.** The system MUST …
- **FR-2.** The system MUST …

## 6. Non-functional requirements
<!-- Performance, security, privacy, accessibility, compliance, observability. Specific and measurable. -->
-

## 7. Data model & contracts
<!-- Typed contracts BEFORE implementation: entities, fields, API shapes, events. The interface code must honour. -->
```
```

## 8. Acceptance criteria
<!-- Objectively verifiable; each maps to FR-N. These become the tests in Stage 5. -->
- **AC-1.** (FR-1) Given … when … then …
- **AC-2.** (FR-2) Given … when … then …

## 9. Open questions
<!-- Unresolved decisions blocking approval. An approved spec has none (or each is deferred with an owner). -->
-

## Changelog

| Version | Date | Level | Note |
| --- | --- | --- | --- |
| {{VERSION}} | {{CREATED}} | init | Initial draft |
