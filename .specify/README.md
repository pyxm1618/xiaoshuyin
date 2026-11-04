# Xiaoshuyin Spec Kit Governance

## Pinned baseline

This repository adopts **GitHub Spec Kit Core v1.2.1** as the process baseline for V1 implementation governance.

When using a shell-enabled coding environment, install the pinned official CLI from the official GitHub release. Do not float to latest during an active feature without an explicit governance update.

Community extensions are intentionally **not** part of the initial baseline. The project already has detailed product, architecture, testing, safety, and release contracts; adding multiple governance extensions now would create overlapping authorities.

## How Spec Kit is used here

Spec Kit is a process harness, not the source of product or architecture truth.

For each implementation slice use the production path:

`constitution → specify → clarify → plan → checklist → tasks → analyze → implement → converge`

Project-specific templates in `.specify/templates/` add mandatory upstream traceability, scope boundaries, and verification evidence.

## Feature lifecycle and what the gate enforces

Spec Kit delivers a feature in stages, and the governance gate accepts those stages:

| Stage | Artifacts present | Gate behaviour |
| --- | --- | --- |
| 1 — specified | `spec.md` | spec sections and an upstream identifier are required; `plan.md` / `tasks.md` may be absent |
| 2 — planned | `spec.md` + `plan.md` | plan sections are required; a plan without a spec fails |
| 3 — tasked | `spec.md` + `plan.md` + `tasks.md` | every task needs `[REQ:...]` and `[VERIFY:...]`; tasks without a plan or spec fail |

A feature directory without `spec.md` is always invalid. Stages only remove the
requirement to have *later* artifacts; nothing about traceability is relaxed.

`specs/` directories starting with `.` or `_` are reserved and not treated as features.

## Docs/** change control

`Docs/**` holds the approved product and technical sources. They are protected by a
gate in `Spec Governance`, not by a pinned commit SHA:

- any change under `Docs/**` fails the gate by default;
- a human may apply the `approved-docs-change` pull request label after reviewing the
  document change itself. The gate then reports the changed files and admits the change
  to normal review;
- the label never disables the validator or the self-test, and it is never an approval
  of document content.

Because a pinned SHA would eventually block a legitimate requirement revision, the
protected invariant is "no unapproved Docs drift reaches `main`", not "Docs never change".

## Verifying this layer

```bash
specify version                                        # must report 1.2.1
specify integration status                             # active integration + managed files
node .specify/scripts/validate-governance.mjs          # repository governance gate
node .specify/scripts/tests/run-governance-tests.mjs   # lifecycle + Docs gate self-test
```

Do not run `specify integration upgrade --force`: the four Xiaoshuyin templates and the
constitution are intentional local customization and would be overwritten.

## Existing Xiaoshuyin roadmap

Do not create a new roadmap. Use `Docs/V1技术设计.md` Phase 1–6:

1. Common Core foundation
2. Digital Use Scene faithful implementation
3. Professional knowledge and AI
4. Execution loop
5. Long-term memory, safety operations, and data rights
6. Real small-scale validation

Each Spec Kit feature is a small slice inside one of these phases.

## ChatGPT / Superpowers

Superpowers may be used as the task-execution discipline for TDD, systematic debugging, plan execution, review, and verification-before-completion.

It does not replace Spec Kit artifacts or Xiaoshuyin's approved documents.
