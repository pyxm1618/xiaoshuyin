# Xiaoshuyin Implementation Specs

Each directory under `specs/` represents one reviewable implementation slice inside the existing V1 Phase 1–6 roadmap.

Typical layout:

```text
specs/
  001-<slice-name>/
    spec.md
    plan.md
    tasks.md
    checklists/
      requirements.md
    research.md       # only when needed
    data-model.md     # only when needed
    contracts/        # only when needed
```

Rules:
- Do not create a feature because an agent thinks it is useful.
- Every slice must map to approved upstream requirements.
- Keep slices narrow enough to implement, verify, review, and converge independently.
- Completed feature artifacts are historical delivery evidence; they do not supersede `Docs/`.
- If upstream requirements change, revise the authoritative document explicitly and then reconcile affected feature artifacts.
