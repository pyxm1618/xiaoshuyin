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
