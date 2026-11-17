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

## Machine-verifiable change provenance

Production implementation ownership is repository-controlled by
`.specify/implementation-ownership.json`. A change-binding manifest may select only a
feature that the registry already authorizes for each production path. Shared ownership is
finite and explicit, longest-match resolution is deterministic, and an unknown production
path fails closed. Ownership-registry changes are governance-sensitive and must not be
combined with product implementation/change-binding changes.

Authority convergence is repository-controlled by
`.specify/authority-unit-registry.json`. The registry defines stable Authority Unit
identities and, where an Authority unit is allowed to affect an existing feature, the exact
feature/spec, downstream requirement selector, and required artifact set. A PR cannot
create these bindings while changing the Authority text. `NO_DOWNSTREAM_IMPACT` is
available only for a registry-declared non-normative unit and a finite allowed exemption
kind; substantive units fail closed until their downstream convergence binding exists.

Completed task evidence uses feature-bound provenance: task feature identity → merged
implementation PR/head → actual PR changed-file set → concrete implementation and
verification artifacts. Evidence artifacts must be present in the referenced PR delta, and
the checked task `[VERIFY:...]` contracts are digest-bound. A successful unrelated PR or
generic successful CI run cannot be reused as universal task evidence.

## Docs/** change control

`Docs/**` contains the approved product and technical sources. The old
`approved-docs-change` label is retained only as historical repository metadata; it has
**zero authority** in the governance gate and cannot prove human review.

For any revision to one of the four Authority Docs, Spec Governance requires:
- the refreshed machine-derived `.specify/authority-inputs.json`;
- exactly one changed `.specify/authority-impacts/*.json` contract binding previous/new
  Authority blob identities;
- an explicit impact classification;
- exact affected authoritative specs and required downstream artifacts when impact exists;
- proof that every declared downstream item exists and changed in the same convergence PR;
- a finite controlled exemption contract for legitimate metadata-only/no-downstream-impact
  corrections.

The repository's GitHub Ruleset is the Human Gate: an independent approving review must
be required, and the latest reviewable push must require a fresh valid approval. Labels,
agent comments, connector events, or the Authority Impact Contract itself are not human
approval.

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
