# Slice 9 Post-Merge CI Remediation — Implementation Tasks (009r)

| Field | Value |
|---|---|
| Feature directory | `specs/009r-slice9-post-merge-ci-remediation/` |
| Requirement authority | `specs/009r-slice9-post-merge-ci-remediation/spec.md` (`S9PM-FR-01` – `S9PM-FR-28`) |
| Task status | PLANNING COMPLETE — READY FOR DEVELOPMENT |
| Remediation branch | `remediation/slice9-post-merge-ci` |
| Remediation worktree (new, clean) | `/Users/milushangdi/Projects/xiaoshuyin-009r-post-merge-ci` |
| Branch origin | latest `origin/main` (fetch first; measured `6fab0b79a942c5bf961a2201138ed02bf3197859` at planning time) |
| Original merge commit (PR #28) | `6fab0b79a942c5bf961a2201138ed02bf3197859` |
| Immutable pre-merge base | `8e393c990be53c888c2e68d881bd8b23f9c37638` |
| Immutable audited feature head | `7b4f5796ef1c6ac1126f9b7bb687293df8a8ceef` |
| Editable files (exactly 2) | `tests/integration/safety-scope-negative.test.ts`, `tests/db/safety-migration-reconcile.test.ts` |
| Forbidden to touch | Slice 8 worktree `/Users/milushangdi/Projects/xiaoshuyin` (branch `feat/008-problem-formulation-core`, `MERGE_HEAD` = `6fab0b79…`, 11 conflicted paths) |
| Merge decision | NOT delegated to the implementing AI. The PR is opened and left unmerged. Slice 9 is NOT closed. |

## Planning-artifact exclusion (mandatory)

`spec.md` and `tasks.md` in this directory are **planning artifacts**. They MUST NOT be committed, staged, or included in the remediation PR or in any branch pushed to the remote. Only the two named test files may ever appear in `git diff origin/main...HEAD` for implementation work.

This is a **stricter user-mandated constraint** that supersedes the optional artifact inclusion described in `S9PM-FR-25(a)`. It does not weaken any requirement: the change surface is narrowed to exactly two files.

## Frozen inputs and measured ground truth (read-only, verified at planning time)

| Item | Measured value | Command used |
|---|---|---|
| `origin/main` | `6fab0b79a942c5bf961a2201138ed02bf3197859` | `git rev-parse origin/main` |
| `6fab0b79…` object type | `commit` | `git cat-file -t 6fab0b79a942c5bf961a2201138ed02bf3197859` |
| `6fab0b79…` ancestry in `origin/main` | ancestor (exit `0`) | `git merge-base --is-ancestor 6fab0b79… origin/main` |
| `8e393c99…` → `7b4f5796…` ancestry | ancestor (exit `0`) | `git merge-base --is-ancestor 8e393c99… 7b4f5796…` |
| Historical changed-path count | `62` (non-empty) | `git diff --name-only 8e393c99…7b4f5796… \| wc -l` |
| Historical migration delta | exactly `A\tdb/migrations/009_safety_hold_control_foundation.sql` | `git diff --name-status 8e393c99…7b4f5796… -- db/migrations/` |
| Pre-merge base migration set | 8 files, highest prefix `007` | `git ls-tree --name-only 8e393c99… db/migrations/` |
| `origin/main` migration set | 9 files (base set + `009`) | `git ls-tree --name-only origin/main db/migrations/` |
| Prefix delta at base | `009 − 007 = 2` | derived |
| Baseline blob, `safety-scope-negative.test.ts` | `918913f2f5597fae6aba0bd3dc0169d515424877` (221 lines, 16 patterns) | `git rev-parse origin/main:tests/integration/safety-scope-negative.test.ts` |
| Baseline blob, `safety-migration-reconcile.test.ts` | `8540a95dfbedeb524503f013e66813e41e8d0306` (175 lines) | `git rev-parse origin/main:tests/db/safety-migration-reconcile.test.ts` |
| Post-merge context diff | `0` paths | `git diff --name-only origin/main...HEAD \| wc -l` |

**Baseline authority warning.** The Slice 8 worktree contains a *different, uncommitted, mid-merge* copy of both target files (15 patterns, `008`/`010` expectations). That copy is **not** a baseline and must never be copied, diffed against, or used as a reference. The only baseline is the `origin/main` blob above.

## Governance Task Index

Machine-readable index. Checkbox state is governance metadata only; it does not assert implementation completion.

- [ ] T9R01 Create a new clean remediation worktree from `origin/main` without disturbing the Slice 8 worktree [REQ:S9PM-FR-27, S9PM-FR-26; spec §4.5] [VERIFY:`git worktree list` shows a new clean worktree at `remediation/slice9-post-merge-ci`; Slice 8 worktree still has `MERGE_HEAD=6fab0b79…` and 11 conflicted paths]
- [ ] T9R02 Re-verify the authority gate against the real fetched remote state [REQ:S9PM-FR-01, S9PM-FR-02, S9PM-FR-27; spec §5.1.1] [VERIFY:merge commit contained in `origin/main`; base→head ancestry exit 0; historical range yields exactly 62 paths; migration delta yields exactly one `A 009` record]
- [ ] T9R03 Pin the baseline blobs, verify the worktree copies match `origin/main`, and prove the pristine pre-edit state [REQ:S9PM-FR-08, S9PM-FR-25] [VERIFY:`git hash-object` of both worktree files equals `918913f2…` / `8540a95d…`; `git status --porcelain` empty]
- [ ] T9R04 Re-record the Input Drift statement at implementation time [REQ:S9PM-FR-27; spec §5.5.3] [VERIFY:drift record with the re-fetched `origin/main` SHA; NONE-or-recorded]
- [ ] T9R05 Reproduce the T918 failure with captured real output [REQ:S9PM-FR-18; spec §5.2.3] [VERIFY:`changed.length = 0` assertion failure captured verbatim, `git diff --name-only origin/main...HEAD \| wc -l` = 0]
- [ ] T9R06 Reproduce the T919 failure with captured real output [REQ:S9PM-FR-18, S9PM-FR-10; spec §5.3.3-1] [VERIFY:`added = []` and `status/untracked = []` assertion failures captured verbatim]
- [ ] T9R07 Attribute the root cause and archive the pre-fix evidence outside the repository [REQ:S9PM-FR-18, S9PM-FR-23] [VERIFY:attribution note states PR #28 merge makes `HEAD == origin/main` ⇒ `origin/main…HEAD` empty by construction; evidence files exist under `/tmp/s9pm-evidence/`]
- [ ] T9R08 Declare the immutable SHA pair and fail-loud range preconditions in both suites [REQ:S9PM-FR-01, S9PM-FR-02, S9PM-FR-04; spec §4.2.2, §4.4.1] [VERIFY:explicit `S9PM_RANGE_UNAVAILABLE` / `S9PM_RANGE_NOT_ANCESTOR` / `S9PM_RANGE_EMPTY` markers reachable; a shallow-clone simulation produces one of them, never PASS]
- [ ] T9R09 Replace the T918 `origin/main...HEAD` inventory with the immutable-range inventory [REQ:S9PM-FR-01, S9PM-FR-03, S9PM-FR-07] [VERIFY:inventory derives from `git diff --name-only <base>..<head>`; working-tree deltas remain supplemental only]
- [ ] T9R10 Restore a non-vacuous non-empty guarantee plus known-content containment in T918 [REQ:S9PM-FR-05, S9PM-FR-04] [VERIFY:inventory length > 0; contains `db/migrations/009_safety_hold_control_foundation.sql` and ≥1 `packages/domain/src/safety/` path; empty synthetic inventory fails with `S9PM_RANGE_EMPTY`]
- [ ] T9R11 Preserve all 16 forbidden patterns verbatim and add a matcher-liveness control [REQ:S9PM-FR-06, S9PM-FR-09] [VERIFY:pattern block diff shows zero changed/removed lines; injected forbidden path is rejected by ≥1 pattern; in-scope Safety path matches none]
- [ ] T9R12 Confirm every non-inventory T918 assertion is byte-identical [REQ:S9PM-FR-08; spec §5.2.1-4] [VERIFY:`git diff origin/main -- tests/integration/safety-scope-negative.test.ts` touches only the inventory block, the precondition helper and the liveness control]
- [ ] T9R13 Replace the T919 `origin/main` migration-set equality with the immutable-range name-status delta [REQ:S9PM-FR-10, S9PM-FR-17; spec §5.3.1-1] [VERIFY:range delta equals exactly `A\tdb/migrations/009_safety_hold_control_foundation.sql`; no `origin/main` token remains]
- [ ] T9R14 Recompute prefix adjacency from the pre-merge base tree, never from `origin/main` [REQ:S9PM-FR-16; spec §5.3.1-7] [VERIFY:base highest prefix = `007`; delta = `2`; unchanged bounds `>= 1` and `<= 2` retained]
- [ ] T9R15 Replace the `origin/main` migration diff with immutable-range historical-edit detection plus the retained working-tree scan [REQ:S9PM-FR-11] [VERIFY:zero `M`/`D`/`R`/`T` over base-set migrations inside the range and in the working tree; untracked scan retained]
- [ ] T9R16 Prove future-slice tolerance with in-file controls [REQ:S9PM-FR-17, S9PM-FR-11(b,c)] [VERIFY:control accepts `A db/migrations/010_example.sql` and rejects `M db/migrations/007_case_primary_switch.sql` using the same predicate as the live assertions]
- [ ] T9R17 Preserve presence/blob equality, fresh apply, second-apply no-op, CHECK literal sets, RLS and `schema_migrations` assertions [REQ:S9PM-FR-12, S9PM-FR-13, S9PM-FR-14, S9PM-FR-15] [VERIFY:those assertion blocks show zero diff; real migrator output captured]
- [ ] T9R18 Anti-weakening review of the final two-file diff [REQ:S9PM-FR-24; AGENTS.md §2] [VERIFY:deleted assertion lines = 0; `skip`/`only`/`todo` = 0; tolerance widening = 0; gate files = 0]
- [ ] T9R19 Change-surface review and planning-artifact exclusion [REQ:S9PM-FR-25, S9PM-FR-26] [VERIFY:`git diff --name-only origin/main...HEAD` lists exactly the two test files; `spec.md`/`tasks.md` untracked and unstaged]
- [ ] T9R20 Run both focused suites and record real counts [REQ:S9PM-FR-19, S9PM-FR-03] [VERIFY:both commands PASS with zero failed tests; pre-merge-context parity either really executed or explicitly `NOT VERIFIED`]
- [ ] T9R21 Commit exactly the two files, then run canonical `verify-all` on a clean tree [REQ:S9PM-FR-20, S9PM-FR-27] [VERIFY:`command FAIL: 0`, `NOT VERIFIED: 0`, `provenance: PASS`, `verify-all: PASS`]
- [ ] T9R22 Record full G1 regression totals and the three regression classifications [REQ:S9PM-FR-21, S9PM-FR-23] [VERIFY:G1 file/test totals quoted from real output with 0 failed; production/migration/test-context classification supported by diff counts]
- [ ] T9R23 Push the branch and open the PR (no merge) [REQ:S9PM-FR-27, S9PM-FR-28] [VERIFY:PR URL recorded; PR body declares `Docs Changed: NO`, two changed files, no spec artifact; PR state `OPEN`]
- [ ] T9R24 Watch exact-head CI across all six gates [REQ:S9PM-FR-22] [VERIFY:six gates `success` on the PR head SHA; `Integration Tests` includes `Run canonical verify-all`]
- [ ] T9R25 Emit the fixed-template final report with permitted status claims only [REQ:S9PM-FR-28, S9PM-FR-23, S9PM-FR-24] [VERIFY:report contains every mandated field and declares only `POST-MERGE CI REMEDIATION COMPLETE` + `READY FOR TARGETED INDEPENDENT AUDIT`]

Global rules for every task:

- edit nothing outside the two named test files;
- never touch the Slice 8 worktree (`/Users/milushangdi/Projects/xiaoshuyin`) — no `stash`, `clean`, `reset`, `checkout`, `add`, `commit`, `merge --abort`, or conflict resolution there;
- never commit or push `specs/009r-slice9-post-merge-ci-remediation/spec.md` or `tasks.md`;
- no `Docs/**`, `AGENTS.md`, `.specify/**`, `.github/**`, `scripts/**`, `package.json`, `bun.lock`, `apps/**`, `packages/**`, `db/migrations/**` change;
- no assertion deletion, no `skip`/`only`/`todo`, no tolerance widening, no gate edit;
- `origin/main` must not appear as an evidence input in either suite after remediation;
- every PASS claim must be backed by freshly captured command output; otherwise report `NOT VERIFIED` or `BLOCKED`.

---

## 1. Establish an isolated remediation workspace and re-verify authority

### 1.1 T9R01 — Create a new clean worktree from `origin/main` without disturbing the Slice 8 worktree

[REQ:S9PM-FR-27, S9PM-FR-26; spec §4.5, §5.5.2]

**Purpose.** Guarantee the remediation runs on a pristine `origin/main` copy so the post-merge failure context is real and reproducible, while the dirty Slice 8 worktree stays byte-identical.

**Steps.**

1. Record the Slice 8 worktree pre-state (read-only): its branch name, `git rev-parse --git-path MERGE_HEAD` content, and the conflicted path count.
2. Fetch and prune the remote in the shared repository (this updates refs only; it does not touch working trees).
3. Create a **new** worktree and branch from the freshly fetched `origin/main` at `/Users/milushangdi/Projects/xiaoshuyin-009r-post-merge-ci`. Do not reuse, rename or re-point any existing worktree.
4. Confirm the new worktree is clean and its `HEAD` equals `origin/main`.
5. Re-read the Slice 8 worktree post-state and confirm it is unchanged (same branch, same `MERGE_HEAD`, same conflicted count). Never run any mutating git command in that worktree.

**Verification evidence.**

```text
git -C /Users/milushangdi/Projects/xiaoshuyin cat .git/MERGE_HEAD
→ 6fab0b79a942c5bf961a2201138ed02bf3197859

git -C /Users/milushangdi/Projects/xiaoshuyin ls-files -u | cut -f2 | sort -u | wc -l
→ 11

git -C /Users/milushangdi/Projects/xiaoshuyin fetch origin --prune
→ exit 0

git -C /Users/milushangdi/Projects/xiaoshuyin worktree add -b remediation/slice9-post-merge-ci \
  /Users/milushangdi/Projects/xiaoshuyin-009r-post-merge-ci origin/main
→ "Preparing worktree" … exit 0

git -C /Users/milushangdi/Projects/xiaoshuyin-009r-post-merge-ci rev-parse HEAD origin/main
→ both lines = 6fab0b79a942c5bf961a2201138ed02bf3197859

git -C /Users/milushangdi/Projects/xiaoshuyin-009r-post-merge-ci status --porcelain
→ (no output)

git -C /Users/milushangdi/Projects/xiaoshuyin worktree list
→ 新增一行 …/xiaoshuyin-009r-post-merge-ci  6fab0b79 [remediation/slice9-post-merge-ci]
→ 原有行 …/xiaoshuyin  21ed135 [feat/008-problem-formulation-core] 保持不变

# post-state equality of the Slice 8 worktree (must match the pre-state exactly)
cat .git/MERGE_HEAD → 6fab0b79a942c5bf961a2201138ed02bf3197859
git ls-files -u | cut -f2 | sort -u | wc -l → 11
```

**If not satisfied.** STOP (`BLOCK-10`) — a changed Slice 8 worktree means another agent's WIP was disturbed.

### 1.2 T9R02 — Re-verify the authority gate against the real fetched state

[REQ:S9PM-FR-01, S9PM-FR-02, S9PM-FR-27; spec §5.1.1, §6.1, §6.3]

**Purpose.** Prove the two frozen SHAs still resolve, still satisfy ancestry, and still produce a non-empty historical inventory and the exact one-record migration delta, before any evidence is derived from them.

**Steps.**

1. Resolve both SHAs and assert they are commit objects.
2. Assert `base → audited head` ancestry and `audited head → HEAD` ancestry (`HEAD` here equals the merge commit).
3. Assert `HEAD`/`origin/main` contains the merge commit.
4. Compute the historical changed-path inventory and assert it is non-empty.
5. Compute the migration delta restricted to `db/migrations/` and assert the single `A` record.
6. Record all outputs verbatim in the evidence file.

**Verification evidence.**

```text
git -C ...-009r-post-merge-ci cat-file -t 8e393c990be53c888c2e68d881bd8b23f9c37638 → commit
git -C ...-009r-post-merge-ci cat-file -t 7b4f5796ef1c6ac1126f9b7bb687293df8a8ceef → commit
git -C ...-009r-post-merge-ci merge-base --is-ancestor 8e393c99…7b4f5796…  ; echo $? → 0
git -C ...-009r-post-merge-ci merge-base --is-ancestor 7b4f5796… HEAD        ; echo $? → 0
git -C ...-009r-post-merge-ci merge-base --is-ancestor 6fab0b79… origin/main  ; echo $? → 0

git -C ...-009r-post-merge-ci diff --name-only 8e393c99…7b4f5796… | wc -l
→ 62

git -C ...-009r-post-merge-ci diff --name-only 8e393c99…7b4f5796… \
  | grep -E '^db/migrations/009_safety_hold_control_foundation\.sql$' | wc -l
→ 1

git -C ...-009r-post-merge-ci diff --name-only 8e393c99…7b4f5796… \
  | grep -E '^packages/domain/src/safety/' | wc -l
→ ≥ 1

git -C ...-009r-post-merge-ci diff --name-status 8e393c99…7b4f5796… -- db/migrations/
→ A<TAB>db/migrations/009_safety_hold_control_foundation.sql   (exactly one line)

git -C ...-009r-post-merge-ci ls-tree --name-only 8e393c99… db/migrations/ | wc -l → 8
git -C ...-009r-post-merge-ci ls-tree --name-only 8e393c99… db/migrations/ \
  | sed 's#db/migrations/##' | sort | tail -1 → 007_case_primary_switch.sql
```

**If not satisfied.** STOP (`BLOCK-05`) — the range is unavailable, non-ancestral or empty. Record the failing marker (`S9PM_RANGE_UNAVAILABLE` / `S9PM_RANGE_NOT_ANCESTOR` / `S9PM_RANGE_EMPTY`).

### 1.3 T9R03 — Pin baseline blobs, verify worktree copies match `origin/main`, prove the pristine pre-edit state

[REQ:S9PM-FR-08, S9PM-FR-25]

**Purpose.** Make the "before" state auditable and prove the Slice 8 mid-merge copy was not carried in.

**Steps.**

1. Compute `git hash-object` for both worktree files and compare with the `origin/main` blob IDs recorded above.
2. Count the forbidden-pattern array entries in the baseline and record the measured count (**16**) — this becomes the invariant T9R11 preserves.
3. Record the baseline line counts and the exact `origin/main`-dependent expressions (three: one in T918, two in T919) that the remediation must remove.
4. Assert `git status --porcelain` and `git ls-files --others --exclude-standard` are both empty.

**Verification evidence.**

```text
git -C ...-009r-post-merge-ci hash-object tests/integration/safety-scope-negative.test.ts
→ 918913f2f5597fae6aba0bd3dc0169d515424877

git -C ...-009r-post-merge-ci hash-object tests/db/safety-migration-reconcile.test.ts
→ 8540a95dfbedeb524503f013e66813e41e8d0306

grep -c '^  /' tests/integration/safety-scope-negative.test.ts → 16
grep -n 'origin/main' tests/integration/safety-scope-negative.test.ts tests/db/safety-migration-reconcile.test.ts
→ 3 matches: line 44 (T918), lines 58 and 169 (T919)
git status --porcelain → (empty)
```

**If not satisfied.** STOP (`BLOCK-11` if the worktree is not pristine / contaminated with Slice 8 content).

### 1.4 T9R04 — Re-record the Input Drift statement at implementation time

[REQ:S9PM-FR-27; spec §5.5.3-1]

**Steps.**

1. Immediately before the first edit, re-fetch and record `git rev-parse origin/main`.
2. If it equals `6fab0b79…`, record `Input Drift: NONE`.
3. If it advanced, record the new SHA as Input Drift, then re-run T9R02 in full. If the authority gate still holds (merge commit contained, ancestry intact, 62-path inventory intact, exact `A 009` delta intact), continue and record the drift. Otherwise STOP (`BLOCK-04`).

**Verification evidence.**

```text
git -C ...-009r-post-merge-ci fetch origin --prune → exit 0
git -C ...-009r-post-merge-ci rev-parse origin/main
→ 6fab0b79a942c5bf961a2201138ed02bf3197859   ⇒ "Input Drift: NONE"
```

---

## 2. Reproduce the three failures before the fix

### 2.1 T9R05 — Reproduce the T918 failure (`changed.length = 0`)

[REQ:S9PM-FR-18; spec §5.2.3-2]

**Purpose.** Prove the failure is a verification-context defect, not a scope violation: the inventory is empty because `HEAD == origin/main`, not because Slice 9 changed nothing.

**Precondition.** PostgreSQL reachable via `TEST_ADMIN_DATABASE_URL` (the suite's first case is DB-free but the file's other cases are not; capture the failing case verbatim regardless).

**Steps.**

1. Run the T918 suite exactly as CI does and capture full stdout/stderr plus the exit code to `/tmp/s9pm-evidence/t918-pre-fix.log`.
2. Assert the captured output contains `expected 0 to be greater than 0` in the `touches no forbidden path in any changed or added file` case.
3. Independently capture the empty post-merge diff, the `HEAD` SHA and the `origin/main` SHA in the same log.
4. Do not modify anything based on this run.

**Verification evidence.**

```text
bunx vitest run tests/integration/safety-scope-negative.test.ts 2>&1 | tee /tmp/s9pm-evidence/t918-pre-fix.log
→ FAIL  tests/integration/safety-scope-negative.test.ts > T918 executable scope negatives > touches no forbidden path in any changed or added file
→ AssertionError: expected 0 to be greater than 0
→ Test Files  1 failed (1)
→ Tests      1 failed | 7 passed (8)      (counts recorded as observed)

git -C ...-009r-post-merge-ci diff --name-only origin/main...HEAD | wc -l → 0
git -C ...-009r-post-merge-ci rev-parse --short HEAD → 6fab0b7
```

**If not satisfied.** If T918 does not fail, the environment is not the post-merge context — STOP (`BLOCK-04` after re-checking `HEAD`).

### 2.2 T9R06 — Reproduce the T919 failure (`added = []`, `status/untracked = []`)

[REQ:S9PM-FR-18, S9PM-FR-10; spec §5.3.3-1]

**Precondition.** `TEST_ADMIN_DATABASE_URL` and `MIGRATION_DATABASE_URL` are set and PostgreSQL 18 is reachable (`beforeAll` creates the ephemeral database).

**Steps.**

1. Run the T919 suite and capture full output plus exit code to `/tmp/s9pm-evidence/t919-pre-fix.log`.
2. Assert three distinct assertion failures appear: `added` deep-equality (empty vs `['009_safety_hold_control_foundation.sql']`), the prefix-delta lower bound (`delta` computed against `origin/main` becomes `0`, violating `>= 1`), and the `status + untracked` deep-equality (empty vs one `A` record).
3. Independently capture `git diff --name-status origin/main -- db/migrations/` (empty), `git ls-files --others --exclude-standard db/migrations/` (empty), and `git ls-tree origin/main db/migrations/` (contains `009`).

**Verification evidence.**

```text
bunx vitest run tests/db/safety-migration-reconcile.test.ts 2>&1 | tee /tmp/s9pm-evidence/t919-pre-fix.log
→ FAIL … > local migration set is exactly latest main + approved Slice 8/9 files
→   AssertionError: expected [] to deeply equal [ '009_safety_hold_control_foundation.sql' ]
→   AssertionError: expected 0 to be greater than or equal to 1
→ FAIL … > contains no historical migration edit
→   AssertionError: expected [] to deeply equal [ 'A\tdb/migrations/009_safety_hold_control_foundation.sql' ]
→ Test Files  1 failed (1)
→ Tests      2 failed | 2 passed (4)      (counts recorded as observed)

git diff --name-status origin/main -- db/migrations/            → (empty)
git ls-files --others --exclude-standard db/migrations/          → (empty)
git ls-tree --name-only origin/main db/migrations/ | tail -1    → db/migrations/009_safety_hold_control_foundation.sql
```

**If not satisfied.** If the T919 `fresh database` and `CHECK literal` cases fail, that indicates a real migration defect, not the context defect → STOP (`BLOCK-12`) and report separately.

### 2.3 T9R07 — Attribute root cause and archive pre-fix evidence outside the repository

[REQ:S9PM-FR-18, S9PM-FR-23]

**Steps.**

1. Write a one-page attribution note to `/tmp/s9pm-evidence/root-cause.md` stating: PR #28 merged `feat/009-safety-hold-control-foundation` into `main` as `6fab0b79…`; in that context `HEAD == origin/main`, therefore every `origin/main…HEAD` and `origin/main`-relative derivation is empty or shifted by construction; the three observed failures are direct consequences.
2. Confirm the note quotes the real captured numbers from T9R05 and T9R06 — no estimates.
3. Confirm the evidence directory is **outside** the repository worktree (canonical `verify-all` runs without `--archive` and requires a clean tracked tree; repository-local evidence files would pollute the change surface and the T918 untracked scan).
4. Confirm `git status --porcelain` is still empty.

**Verification evidence.**

```text
ls -1 /tmp/s9pm-evidence/
→ root-cause.md  t918-pre-fix.log  t919-pre-fix.log

git -C ...-009r-post-merge-ci status --porcelain → (empty)
```

---

## 3. Remediate T918 (`tests/integration/safety-scope-negative.test.ts`)

Edit only this file in group 3. All other assertions in the file must remain byte-identical.

### 3.1 T9R08 — Declare the immutable SHA pair and fail-loud range preconditions in both suites

[REQ:S9PM-FR-01, S9PM-FR-02, S9PM-FR-04; spec §4.2.2, §4.4.1, §4.4.2]

**Steps.**

1. Add exactly two named module-level constants in each file — `SLICE9_PRE_MERGE_BASE_SHA = '8e393c990be53c888c2e68d881bd8b23f9c37638'` and `SLICE9_AUDITED_FEATURE_HEAD_SHA = '7b4f5796ef1c6ac1126f9b7bb687293df8a8ceef'`. No magic string repetition inside assertions; no shared helper module (a third file is forbidden).
2. Add a local precondition assertion (inside the existing `describe`, or in `beforeAll` for T919 where the DB pool already exists) that: both SHAs resolve to commits; the base is an ancestor of the audited head; the audited head is an ancestor of `HEAD`.
3. Emit the explicit failure markers `S9PM_RANGE_UNAVAILABLE` (unresolvable SHAs, with the missing SHA and the `fetch-depth: 0` requirement in the message), `S9PM_RANGE_NOT_ANCESTOR` (naming the violated edge), `S9PM_RANGE_EMPTY` (inventory resolved to zero paths).
4. Assert the post-merge ancestry case still passes (the audited head is a strict ancestor of `HEAD`, not equal to it).
5. Keep the git access read-only: `rev-parse`, `cat-file`, `merge-base`, `diff`, `ls-tree`. No `fetch`, `checkout`, `reset`, `worktree` calls inside the suites.

**Verification evidence.**

```text
grep -n "SLICE9_PRE_MERGE_BASE_SHA\|SLICE9_AUDITED_FEATURE_HEAD_SHA" \
  tests/integration/safety-scope-negative.test.ts tests/db/safety-migration-reconcile.test.ts
→ 2 declarations per file, no inline 40-char SHA literal elsewhere

grep -c "8e393c990be53c888c2e68d881bd8b23f9c37638" tests/integration/safety-scope-negative.test.ts → 1
grep -c "8e393c990be53c888c2e68d881bd8b23f9c37638" tests/db/safety-migration-reconcile.test.ts    → 1

grep -n "S9PM_RANGE_UNAVAILABLE\|S9PM_RANGE_NOT_ANCESTOR\|S9PM_RANGE_EMPTY" \
  tests/integration/safety-scope-negative.test.ts tests/db/safety-migration-reconcile.test.ts
→ each marker reachable in both files

# shallow-clone simulation (must fail loudly, never PASS)
git clone --depth=1 --no-local file://…/xiaoshuyin /tmp/s9pm-shallow && \
  ( run the T918 inventory in that clone )
→ S9PM_RANGE_UNAVAILABLE   (no PASS)
```

**If not satisfied.** If the markers cannot be reached without a third file → STOP (`BLOCK-01`).

### 3.2 T9R09 — Replace the T918 `origin/main...HEAD` inventory with the immutable-range inventory

[REQ:S9PM-FR-01, S9PM-FR-03, S9PM-FR-07]

**Steps.**

1. Remove the `origin/main...HEAD` derivation and replace it with the immutable-range name-only derivation over `SLICE9_PRE_MERGE_BASE_SHA..SLICE9_AUDITED_FEATURE_HEAD_SHA` as the **sole** source of the non-empty guarantee.
2. Keep the two working-tree derivations (`git diff --name-only` for unstaged changes and `git ls-files --others --exclude-standard` for untracked files) as **supplementary** inputs only; they may augment the scanned set but must not be the source of the non-empty guarantee.
3. Keep the union, the trim/filter of blank lines, the per-path loop over the preserved pattern array, and the `forbidden path changed: <path>` failure message unchanged in structure.
4. Rename the case title so it names the immutable range (e.g. `touches no forbidden path in the audited Slice 9 range 8e393c99..7b4f5796 or the working tree`), so no future reader reads it as "current main vs HEAD".
5. Add no conditional on branch name, `HEAD`-equality, merged-ness, or environment.

**Verification evidence.**

```text
grep -c "origin/main" tests/integration/safety-scope-negative.test.ts → 0
grep -n "if (.*merged\|skipIf\|describe\.skip\|process.env.*CI" tests/integration/safety-scope-negative.test.ts → (no output)
bunx vitest run tests/integration/safety-scope-negative.test.ts → Test Files 1 passed (1); Tests 8 passed (8)
```

### 3.3 T9R10 — Restore a non-vacuous non-empty guarantee plus known-content containment

[REQ:S9PM-FR-05, S9PM-FR-04]

**Steps.**

1. Retain the existing `changed.length > 0` assertion against the union (now guaranteed non-empty by the immutable range).
2. Add containment assertions for known Slice 9 content: the inventory contains `db/migrations/009_safety_hold_control_foundation.sql`, and contains at least one path matching `^packages/domain/src/safety/`.
3. Do **not** pin the exact count `62` inside the suite (spec Open Decision 2): assert `> 0` plus containment, and record the measured `62` in the report only.
4. Ensure the empty-evidence path is unreachable: when the range yields zero paths the suite must fail with `S9PM_RANGE_EMPTY` before the negative scan (T9R08) can run.

**Verification evidence.**

```text
bunx vitest run tests/integration/safety-scope-negative.test.ts -t "immutable range" → 1 passed
grep -n "toBeGreaterThan(0)" tests/integration/safety-scope-negative.test.ts → present (retained)
grep -n "009_safety_hold_control_foundation.sql\|packages/domain/src/safety/" \
  tests/integration/safety-scope-negative.test.ts → both containment assertions present
grep -n "62" tests/integration/safety-scope-negative.test.ts → (no pinned count assertion)
```

**If not satisfied.** A zero-path inventory in a resolvable range is a hard STOP (`BLOCK-02`).

### 3.4 T9R11 — Preserve all 16 forbidden patterns verbatim and add a matcher-liveness control

[REQ:S9PM-FR-06, S9PM-FR-09]

**Steps.**

1. Leave the 16-entry `FORBIDDEN_PATH_PATTERNS` array byte-identical, including `problem[_-]?formulations?\.(ts|sql)$` and `safety[_-]?states?`. Do not reorder, rename, merge, case-change or extend it. The measured baseline count is **16**.
2. Inside the same inventory case (no new test case, so the case count stays `8`), add a liveness control: take one known-forbidden synthetic path (e.g. `docs/support_resources/example.md`), assert at least one preserved pattern matches it; and take one in-scope Slice 9 path (`packages/domain/src/safety/guard.ts`), assert no preserved pattern matches it.
3. The control must use the same array instance the live scan iterates — no duplicated pattern list, no loosened regex.
4. Record the diff of the pattern block as evidence of zero change.

**Verification evidence.**

```text
git diff origin/main -- tests/integration/safety-scope-negative.test.ts \
  | grep -E '^[+-]\s+/' → (no output: zero pattern lines added/removed)

grep -c '^  /' tests/integration/safety-scope-negative.test.ts → 16

bunx vitest run tests/integration/safety-scope-negative.test.ts -t "immutable range" → passed
# negative control: temporarily inject a forbidden path into the inventory via the synthetic
# array used by the control assertion only → at least one pattern rejects it (assertion holds)
```

**If the pattern set cannot stay at 16 while preserving every other assertion.** STOP (`BLOCK-07`) — do not add or delete a pattern to make a test pass.

### 3.5 T9R12 — Confirm every non-inventory T918 assertion is byte-identical

[REQ:S9PM-FR-08; spec §5.2.1-4]

**Steps.**

1. Diff the file against `origin/main` and classify every changed hunk as one of: SHA constants, precondition helper, inventory construction, non-emptiness/containment, liveness control, case title. Anything else is a finding.
2. Assert zero changes in: forbidden DB object list (11 names + `risk_events` presence), `risk_events` current-state column negatives (`current_status`, `current_state`, `is_held`, `active`), OpenAPI/route Safety mutation negatives, controlled-resolver export negatives, AI/RAG/Guardrails/referral import scan, the exact three-entry `transitionCaseStatus` caller list (`enter-safety-hold.ts`, `resolve-risk.ts`, `case-transition.ts`), and the S9-H01 generic-status-writer block.
3. Record the hunk classification table in the evidence file.

**Verification evidence.**

```text
git diff --stat origin/main -- tests/integration/safety-scope-negative.test.ts
→ small, additions-only-ish stat; record exact +N −M

git diff origin/main -- tests/integration/safety-scope-negative.test.ts | grep -E '^-[^-]' 
→ only the removed `origin/main...HEAD` derivation line(s)

grep -c "expect(" tests/integration/safety-scope-negative.test.ts
→ new count ≥ baseline count (never lower)
```

---

## 4. Remediate T919 (`tests/db/safety-migration-reconcile.test.ts`)

Edit only this file in group 4. Fresh apply, second apply, CHECK literals, RLS and presence assertion blocks must remain byte-identical.

### 4.1 T9R13 — Replace `origin/main` migration-set equality with the immutable-range name-status delta

[REQ:S9PM-FR-10, S9PM-FR-17; spec §5.3.1-1]

**Steps.**

1. Remove the `git ls-tree --name-only origin/main db/migrations/` derivation used as the equality baseline.
2. Compute the authoritative migration delta as `git diff --name-status <SLICE9_PRE_MERGE_BASE_SHA>..<SLICE9_AUDITED_FEATURE_HEAD_SHA> -- db/migrations/` and assert it equals exactly one record: `A\tdb/migrations/009_safety_hold_control_foundation.sql`. This is the assertion that produced `added = []` before the fix and must now be non-empty and exact.
3. Output nothing weaker: the comparison is an exact deep equality against the single record, not a `toContain` and not a cardinality range.
4. Keep the local listing derivation (`readdirSync(db/migrations)` filtered to `.sql`, sorted) — it is still needed for the removal and presence checks.
5. Rename the case title so it names the immutable range instead of "latest main".

**Verification evidence.**

```text
grep -c "origin/main" tests/db/safety-migration-reconcile.test.ts → 0

bunx vitest run tests/db/safety-migration-reconcile.test.ts -t "immutable" 
→ 1 passed (0 failed)

# independent confirmation of the expected value
git diff --name-status 8e393c99…7b4f5796… -- db/migrations/
→ A<TAB>db/migrations/009_safety_hold_control_foundation.sql
```

**If the delta is empty or contains `M`/`D`/`R`/`T`.** STOP (`BLOCK-02`) — that would be a genuine migration-contract violation, not the context defect.

### 4.2 T9R14 — Recompute prefix adjacency from the pre-merge base tree

[REQ:S9PM-FR-16; spec §5.3.1-7]

**Steps.**

1. Replace the prefix baseline source with `git ls-tree --name-only <SLICE9_PRE_MERGE_BASE_SHA> db/migrations/` so the adjacency is recomputed from the tree that existed before Slice 9 (`008` was reserved by the unmerged Slice 8 branch).
2. Retain the bounds **unchanged**: `delta >= 1` and `delta <= 2`. Do not widen to `<= 3`, do not replace with `toBeGreaterThanOrEqual` on a different quantity.
3. Retain the reuse rejection: the `009` prefix must not equal any prefix present in the base set.
4. Retain the `removed` equality against the base set (`expect(removed).toEqual([])`), which is now future-tolerant only for additions — removals of base-set files still fail.
5. Do not assert "current `main` set == base set + 009" anywhere.

**Verification evidence.**

```text
git ls-tree --name-only 8e393c99… db/migrations/ | sed 's#db/migrations/##' | sort | tail -1
→ 007_case_primary_switch.sql          (highest prefix 007)
# derived delta: 9 − 7 = 2                ⇒ >= 1 and <= 2 both hold

grep -n "toBeLessThanOrEqual(2)" tests/db/safety-migration-reconcile.test.ts → present and unchanged
grep -n "toEqual(\[\])" tests/db/safety-migration-reconcile.test.ts → `removed` equality retained
grep -c "origin/main" tests/db/safety-migration-reconcile.test.ts → 0
```

### 4.3 T9R15 — Replace the `origin/main` migration diff with immutable-range historical-edit detection plus the retained working-tree scan

[REQ:S9PM-FR-11]

**Steps.**

1. Remove `git diff --name-status origin/main -- db/migrations/` as the historical-edit authority.
2. Add the immutable-range historical-edit assertion: over `git diff --name-status <base>..<audited head> -- db/migrations/`, the only permitted record is the single `A` for the Slice 9 file; any `M`, `D`, `R` or `T` record must fail naming the status and path.
3. Add the working-tree historical-edit assertion: for every path in the pre-merge base migration set, `git diff --name-status <base> -- <path>` (restricted to base-set paths) must contain no `M`/`D`/`R`/`T` record. This preserves the old intent (nothing pre-existing may be modified, renamed or deleted) while dropping the mutable `origin/main` authority.
4. Retain the untracked scan (`git ls-files --others --exclude-standard db/migrations/`) but with future tolerance: an untracked `db/migrations/*.sql` is legal **unless** its filename duplicates a base-set filename (a shadowing untracked copy is an edit attempt and must fail).
5. Keep the union-and-compare structure so no historical edit can slip through; the failing message must name the status and the path.

**Verification evidence.**

```text
grep -c "origin/main" tests/db/safety-migration-reconcile.test.ts → 0
bunx vitest run tests/db/safety-migration-reconcile.test.ts -t "historical migration edit" → passed

# simulated edit control (executed, then reverted in the same working tree)
cp db/migrations/007_case_primary_switch.sql /tmp/s9pm-007.bak && \
  printf '\n-- s9pm control\n' >> db/migrations/007_case_primary_switch.sql && \
  bunx vitest run tests/db/safety-migration-reconcile.test.ts -t "historical migration edit"
→ FAIL naming "M\tdb/migrations/007_case_primary_switch.sql"
cp /tmp/s9pm-007.bak db/migrations/007_case_primary_switch.sql && \
  git -C ...-009r-post-merge-ci status --porcelain db/migrations/ → (empty)
```

**If the simulated edit does not fail.** STOP (`BLOCK-08`) — the detection is not live.

### 4.4 T9R16 — Prove future-slice tolerance with in-file controls

[REQ:S9PM-FR-17, S9PM-FR-11(b)(c)]

**Steps.**

1. In the same historical-edit case, add two control assertions that exercise the **same predicate** used by the live assertions: a synthetic `A\tdb/migrations/010_example.sql` record must be accepted (yielding no historical-edit violation), and a synthetic `M\tdb/migrations/007_case_primary_switch.sql` record must be rejected.
2. Also assert structurally that the comparison baseline is the immutable base tree (the base tree contains `007` as its highest prefix and does not contain `009`), so a future `010` cannot invalidate any assertion.
3. Add no new test case (case count stays `4`) and create no migration file — the control is purely in-memory.

**Verification evidence.**

```text
bunx vitest run tests/db/safety-migration-reconcile.test.ts -t "historical migration edit" → passed
grep -n "010_" tests/db/safety-migration-reconcile.test.ts → present only inside the synthetic control
ls db/migrations/ | grep -c '^010_' → 0   (no real migration created by the remediation)
git status --porcelain → (empty)
```

### 4.5 T9R17 — Preserve presence/blob equality, fresh apply, second-apply no-op, CHECK literals, RLS and `schema_migrations`

[REQ:S9PM-FR-12, S9PM-FR-13, S9PM-FR-14, S9PM-FR-15]

**Steps.**

1. Add (do not replace) the presence and blob-equality evidence: the Slice 9 migration exists in the tree at `HEAD`, and its blob at the audited head equals its blob at `HEAD` (via `git cat-file`/`rev-parse <rev>:<path>`), so a post-audit silent edit is detectable.
2. Leave the fresh-apply + second-apply case byte-identical: `APPLY 009_safety_hold_control_foundation.sql`, `Migration complete: N new` with positive `N`, then `Migration complete: 0 new, M previously applied.` with no `APPLY`.
3. Leave the four CHECK literal sets byte-identical: `case_events_event_type_check` (5 literals), `business_audit_events_event_type_check` (5), `idempotency_keys_command_type_check` (5), `risk_events_shape_check` (`HOLD_ENTERED`).
4. Leave the schema-object block byte-identical: exactly one `risk_events` table, `relrowsecurity = true` **and** `relforcerowsecurity = true`, and `schema_migrations` contains the Slice 9 filename.
5. Leave the ephemeral-database lifecycle byte-identical: unique database name, `CREATE DATABASE … OWNER xiaoshuyin_migrator`, `DROP DATABASE … WITH (FORCE)` in `afterAll` including on failure, `120_000 ms` budgets unchanged (no budget increase).

**Verification evidence.**

```text
git diff origin/main -- tests/db/safety-migration-reconcile.test.ts \
  | grep -E '^[+-].*(CHECK literal|HOLD_ENTERED|relrowsecurity|schema_migrations|previously applied|APPLY)' 
→ (no output: those blocks unchanged)

bunx vitest run tests/db/safety-migration-reconcile.test.ts
→ Test Files 1 passed (1); Tests 4 passed (4)
→ captured migrator output contains "APPLY 009_safety_hold_control_foundation.sql" and "Migration complete: N new"
```

---

## 5. Anti-weakening and change-surface review

### 5.1 T9R18 — Anti-weakening review of the final two-file diff

[REQ:S9PM-FR-24; AGENTS.md §2]

**Steps.**

1. Compute the diff against `origin/main` for both files and enumerate every removed line; classify each. Removed lines may only be the `origin/main`-dependent derivations and the assertions that encoded the mutable-main expectation (which are simultaneously replaced by strictly stronger immutable-range assertions in the same hunk).
2. Assert zero occurrences of `it.skip`, `describe.skip`, `it.only`, `describe.only`, `.todo(`, `skipIf`, `expect.anything()`, or a widened tolerance (`toBeGreaterThanOrEqual` substituted where an exact `toEqual` was required).
3. Assert zero change under `scripts/verify-all.mjs`, `.github/**`, coverage-audit thresholds, or the gate row set.
4. Assert the "does the invariant still get enforced" property: for each hunk where an exact equality existed before, an exact equality exists after (never `toContain`, never a range).
5. Record the classification table and the counts (`removed assertion lines: 0`, `skip/only/todo: 0`, `gate edits: 0`).

**Verification evidence.**

```text
git diff origin/main -- tests/integration/safety-scope-negative.test.ts tests/db/safety-migration-reconcile.test.ts \
  | grep -cE '^\+.*\b(it|describe)\.(skip|only|todo)\b' → 0

git diff --name-only origin/main...HEAD -- scripts .github package.json bun.lock → (empty)

git diff origin/main -- tests/ | grep -E '^-[^-].*expect\(' → enumerate and justify each; expected 3
  (T918 `toBeGreaterThan(0)` is retained, not removed; T919 `added` equality and
   `status+untracked` equality are replaced by stronger exact range assertions)
```

### 5.2 T9R19 — Change-surface review and planning-artifact exclusion

[REQ:S9PM-FR-25, S9PM-FR-26]

**Steps.**

1. Assert `git diff --name-only origin/main...HEAD` lists exactly the two test files (plus nothing else).
2. Assert zero changes under `apps/**`, `packages/**`, `db/migrations/**`, `Docs/**`, `AGENTS.md`, `.specify/**`, `.github/**`, `scripts/**`, `package.json`, `bun.lock`, and zero change under `specs/009-safety-hold-control-foundation/**`.
3. Assert `specs/009r-slice9-post-merge-ci-remediation/spec.md` and `tasks.md` are **untracked and unstaged**; if either is staged, unstage it immediately (STOP `BLOCK-11`) — they must never enter the commit.
4. Assert `git status --porcelain` reports no modification outside the two files.

**Verification evidence.**

```text
git -C ...-009r-post-merge-ci diff --name-only origin/main...HEAD
→ tests/db/safety-migration-reconcile.test.ts
→ tests/integration/safety-scope-negative.test.ts

git -C ...-009r-post-merge-ci diff --name-only origin/main...HEAD -- apps packages db Docs AGENTS.md .specify .github scripts package.json bun.lock → (empty)

git -C ...-009r-post-merge-ci status --porcelain | grep -E 'specs/009r' 
→ `?? specs/009r-slice9-post-merge-ci-remediation/`   (untracked, never `A ` / `M `)

git -C ...-009r-post-merge-ci status --porcelain → only the two ` M` entries plus the untracked planning directory
```

**If a third implementation file appears necessary.** STOP (`BLOCK-01`) and write the technical-necessity proof; never edit it.

---

## 6. Verification and evidence

### 6.1 T9R20 — Run both focused suites and record real counts

[REQ:S9PM-FR-19, S9PM-FR-03, S9PM-FR-01]

**Steps.**

1. Run the two focused suites on the remediation worktree (post-merge context: `HEAD == origin/main`), capturing full output and exit codes to `/tmp/s9pm-evidence/`.
2. Record the observed `Test Files` / `Tests` totals verbatim; both runs must report zero failed tests. Expected case counts: T918 = 8, T919 = 4 (the remediation adds assertions, not new cases).
3. Record the merge-context-independence evidence: zero `origin/main` tokens in both files, zero branch/HEAD/merged conditionals, and confirmation that both suites derive their evidence from `8e393c99…7b4f5796…`, which is independent of `HEAD`.
4. Pre-merge context parity (`S9PM-FR-03(b)`): if a scratch detached worktree at `7b4f5796…` with the two patched files overlaid and dependencies available can be produced without touching repository files, run both suites there and record PASS. If that cannot be done safely, record exactly `PRE-MERGE CONTEXT RERUN: NOT VERIFIED (structural parity only)` and do not claim PASS for that sub-claim.
5. Re-run both suites a second time unchanged and confirm identical verdicts and counts (determinism, `S9PM-FR-03`).

**Verification evidence.**

```text
bunx vitest run tests/integration/safety-scope-negative.test.ts
→ Test Files  1 passed (1)
→ Tests       8 passed (8)
→ exit 0

bunx vitest run tests/db/safety-migration-reconcile.test.ts
→ Test Files  1 passed (1)
→ Tests       4 passed (4)
→ exit 0

grep -c "origin/main" tests/integration/safety-scope-negative.test.ts tests/db/safety-migration-reconcile.test.ts
→ 0 for both files
```

### 6.2 T9R21 — Commit exactly the two files, then run canonical `verify-all` on a clean tree

[REQ:S9PM-FR-20, S9PM-FR-27]

**Purpose.** Canonical `verify-all` (no `--archive`) fails provenance when the tracked tree is not clean at start, so the commit must precede the run.

**Steps.**

1. Stage exactly the two files by explicit pathspec (never `git add -A`, never the `specs/009r-*` directory).
2. Commit with a remediation-scoped message that names the immutable range.
3. Confirm the tracked tree is clean (`git status --porcelain --untracked-files=no` empty) before running the runner; the planning directory stays untracked, which the runner tolerates.
4. Run `node scripts/verify-all.mjs` (canonical, no `--archive`) and capture the full log to `/tmp/s9pm-evidence/verify-all.log`.
5. Assert the summary block contains `command PASS: <n>`, `command FAIL: 0`, `NOT VERIFIED: 0`, `provenance: PASS`, `tracked working tree (end): clean`, `verify-all: PASS`, and exit code `0`.
6. Assert the G1 row `[G1 全量测试套件] 结果: PASS`.
7. Re-confirm the committed diff contains exactly the two test files (`git show --name-only --format= HEAD`).

**Verification evidence.**

```text
git add tests/integration/safety-scope-negative.test.ts tests/db/safety-migration-reconcile.test.ts
git status --porcelain --untracked-files=no → two `M`/`A` entries only, both under tests/
git commit -m "test(slice9): derive scope and migration evidence from immutable 8e393c99..7b4f5796 range"
→ commit created

git show --name-only --format= HEAD
→ tests/db/safety-migration-reconcile.test.ts
→ tests/integration/safety-scope-negative.test.ts

node scripts/verify-all.mjs 2>&1 | tee /tmp/s9pm-evidence/verify-all.log ; echo "exit=$?"
→ - command FAIL: 0
→ - NOT VERIFIED: 0
→ - provenance: PASS
→ - verify-all: PASS
→ exit=0
```

**If any non-Slice-9 row fails.** STOP (`BLOCK-03`) — report the exact row and captured output; never edit the row, the gate, or a threshold.

### 6.3 T9R22 — Record full G1 regression totals and the three regression classifications

[REQ:S9PM-FR-21, S9PM-FR-23]

**Steps.**

1. Extract the G1 totals from the canonical run output (`Test Files`, `Tests`, `failed`, duration) and record the **observed** numbers. Do not copy the pre-merge baseline (231 files / 1397 tests) as if it were the remediation result.
2. Assert zero failed files and zero failed tests in G1.
3. Record the three classifications with supporting evidence: `Production Runtime Regression: NO` (zero changed files under `apps/**` and `packages/**`), `Migration Runtime Regression: NO` (zero changed files under `db/migrations/**` plus green fresh/second apply), `Test Context Defect: YES` (the reproduced pre-fix outputs from T9R05/T9R06 plus the immutable-range fix).
4. Record the exact counts used for each classification.

**Verification evidence.**

```text
grep -E "Test Files|Tests " /tmp/s9pm-evidence/verify-all.log | tail -4
→ Test Files  <N> passed (<N>)
→ Tests       <M> passed (<M>)          (both N and M quoted as observed; failed = 0)

git diff --name-only origin/main...HEAD -- apps packages → (empty)
git diff --name-only origin/main...HEAD -- db/migrations → (empty)
```

### 6.4 T9R23 — Push the branch and open the PR (no merge)

[REQ:S9PM-FR-27, S9PM-FR-28]

**Steps.**

1. Push only `remediation/slice9-post-merge-ci` to `origin`. Never push to `main`.
2. Open the PR against `main` with a body that states: the defect (context, not behaviour); the exact immutable range; the two changed files; `Production Runtime Regression: NO`, `Migration Runtime Regression: NO`, `Test Context Defect: YES`; `Docs Changed: NO`; and explicitly that no planning artifact (`spec.md` / `tasks.md`) is included.
3. Assert the PR file list contains exactly two files and the PR state is `OPEN`.
4. Do not merge. Do not enable auto-merge. Do not declare Slice 9 closed.

**Verification evidence.**

```text
git -C ...-009r-post-merge-ci push -u origin remediation/slice9-post-merge-ci
→ branch created on remote at the remediation commit

gh pr create --base main --head remediation/slice9-post-merge-ci --title "…" --body "…"
→ https://github.com/pyxm1618/xiaoshuyin/pull/<N>

gh pr view <N> --json state,files,headRefOid
→ state: "OPEN"; files.length: 2; headRefOid: <remediation head sha>
```

### 6.5 T9R24 — Watch exact-head CI across all six gates

[REQ:S9PM-FR-22]

**Steps.**

1. Watch the checks bound to the exact PR head SHA (not to an older commit, not to a cancelled run).
2. Assert all six gate names report `success`: `Spec Governance`, `Static Checks`, `Unit Tests`, `Integration Tests`, `DB Migration`, `Contract`.
3. Assert the `Integration Tests` job contains the step `Run canonical verify-all` and that the uploaded `verify-all-<sha>-<attempt>` provenance artifact exists for that run.
4. Record the run URL, head SHA, and per-gate conclusion verbatim. If a run is queued/cancelled/stale, report `IN PROGRESS` or `FAIL` — never `PASS`.

**Verification evidence.**

```text
gh pr checks <N> --watch --interval 30
→ Spec Governance        pass
→ Static Checks          pass
→ Unit Tests             pass
→ Integration Tests      pass
→ DB Migration           pass
→ Contract               pass

gh api repos/pyxm1618/xiaoshuyin/commits/<head sha>/check-runs \
  --jq '.check_runs[] | "\(.name)\t\(.conclusion)"'
→ six rows, all "success"

gh run view <integration run id> --json jobs \
  --jq '.jobs[].steps[] | select(.name=="Run canonical verify-all") | "\(.name)\t\(.conclusion)"'
→ Run canonical verify-all	success
```

**If any gate fails.** STOP (`BLOCK-06`) — do not modify the gate, the assertion, or re-run blindly; capture the log and report FAIL/BLOCKED.

### 6.6 T9R25 — Emit the fixed-template final report with permitted status claims only

[REQ:S9PM-FR-28, S9PM-FR-23, S9PM-FR-24]

**Steps.**

1. Emit the report with exactly these fields, each backed by captured output: merge commit; remediation branch/head/PR; authority gate verdict; Input Drift; root cause; three regression classifications; changed files (2); production/migration/specs-docs change counts (0/0/0); T918 verdict; T919 verdict; historical range; non-empty path count (62); `009` proof; historical migration edits (0); focused tests (real counts); `verify-all` summary; full regression totals (real counts); exact-head CI per gate; scope drift; final status.
2. Final status values are limited to `POST-MERGE CI REMEDIATION COMPLETE` and `READY FOR TARGETED INDEPENDENT AUDIT`.
3. Explicitly state what is **not** claimed: no merge, no `Slice 9 CLOSED`, no pre-merge-context PASS if that rerun was `NOT VERIFIED`.
4. State `Docs Changed: NO` and `Planning artifacts committed: NO`.

**Verification evidence.**

```text
Report contains, verbatim, in the fixed order:
  Merge commit / Remediation branch / Remediation head / PR
  Authority Gate: PASS|FAIL + the four measured gate facts
  Input Drift: NONE | <sha>
  Root cause: …
  Production Runtime Regression: NO
  Migration Runtime Regression: NO
  Test Context Defect: YES
  Changed Files: 2
  Production files changed: 0 / Migration files changed: 0 / Docs+specs changed: 0
  T918: PASS / T919: PASS
  Historical range: 8e393c99…7b4f5796…
  Non-empty historical paths: 62
  009 proof: A db/migrations/009_safety_hold_control_foundation.sql
  Historical migration edits: 0
  Focused tests: T918 8/8, T919 4/4
  verify-all: PASS (FAIL 0 / NOT VERIFIED 0 / provenance PASS)
  Full regression: <observed files>/<observed tests>, 0 failed
  Exact-head CI: 6/6 PASS on <head sha>
  Scope drift: NONE
  Final status: POST-MERGE CI REMEDIATION COMPLETE — READY FOR TARGETED INDEPENDENT AUDIT
```

---

## STOP / BLOCK conditions

The implementing agent stops at the smallest safe point and reports the condition verbatim. It never converts a failure into a PASS by editing an assertion, a gate, or a threshold.

| ID | Condition | Detection | Required action |
|---|---|---|---|
| `BLOCK-01` | A third implementation file appears technically necessary | `git status` shows any path outside the two test files; or an edit is needed in `scripts/**`, `apps/**`, `packages/**`, `db/migrations/**` | STOP. Write the technical-necessity proof, do not edit, report `BLOCKED pending justification` |
| `BLOCK-02` | A forbidden path or a `M`/`D`/`R`/`T` record appears inside the immutable range | `S9PM_RANGE_EMPTY`; `forbidden path changed: <path>`; migration delta ≠ single `A 009` | STOP — Slice 9's scope/migration claim would be false; do not relax anything |
| `BLOCK-03` | A canonical `verify-all` row fails for an unrelated cause | `command FAIL: > 0` on a non-Slice-9 row | STOP; report the exact row + captured output; zero gate/row/threshold edits |
| `BLOCK-04` | `origin/main` advanced beyond `6fab0b79…` | re-fetch shows a new `origin/main` SHA | Record Input Drift; re-run the authority gate; if the range/preconditions are unaffected, continue with the drift recorded, otherwise STOP |
| `BLOCK-05` | Immutable range unresolvable, non-ancestral, or empty | `S9PM_RANGE_UNAVAILABLE` / `S9PM_RANGE_NOT_ANCESTOR` / `S9PM_RANGE_EMPTY` | STOP; name the missing SHA / violated edge; never silent-skip |
| `BLOCK-06` | CI cannot reach or fails on the exact head | any gate ≠ `success` on the PR head SHA; run queued/cancelled/stale | Report the real state (`IN PROGRESS` / `FAIL`); no merge; no gate edit |
| `BLOCK-07` | The preserved forbidden-pattern set cannot stay at the measured 16 entries | a pattern line is added, removed or edited; a test would only pass with a changed regex | STOP; report the pattern-set discrepancy; do not add/delete patterns to make a run green |
| `BLOCK-08` | Anti-weakening review finds a deletion, skip/only/todo, tolerance widening, or gate edit | T9R18 counts ≠ 0 | STOP; revert the weakening and redo the hunk with a strictly stronger assertion |
| `BLOCK-09` | Pre-merge context parity cannot be executed safely | no scratch detached worktree with dependencies available | Record `PRE-MERGE CONTEXT RERUN: NOT VERIFIED (structural parity only)`; never claim that PASS |
| `BLOCK-10` | The Slice 8 worktree was modified | `MERGE_HEAD` ≠ `6fab0b79…`, or conflicted count ≠ 11, or any staged/dirty change differs from the pre-state | STOP immediately; report the disturbance; do not "repair" Slice 8 |
| `BLOCK-11` | `spec.md` / `tasks.md` (or any planning artifact) is staged or committed | `git status` shows `A specs/009r-…`; `git show --name-only` contains it | STOP; unstage/remove from the index; re-verify the commit contains exactly two files |
| `BLOCK-12` | Database unavailable or the fresh/second apply or CHECK/RLS evidence fails | `beforeAll` connection failure; missing `APPLY 009`; missing literal; RLS flags false | STOP; classify as infrastructure vs real migration regression explicitly; never drop an assertion |

Additional hard stops:

- any temptation to make the green state by editing `scripts/verify-all.mjs`, `.github/**`, coverage-audit thresholds, or CI configuration;
- any temptation to add `if (merged)` / `skipIf` / `describe.skip` context branching;
- any request to merge the PR or declare Slice 9 closed.

---

## Requirement coverage matrix

| Requirement | Covered by |
|---|---|
| `S9PM-FR-01` | T9R02, T9R08, T9R09 |
| `S9PM-FR-02` | T9R02, T9R08 |
| `S9PM-FR-03` | T9R09, T9R20 |
| `S9PM-FR-04` | T9R08, T9R10 |
| `S9PM-FR-05` | T9R10 |
| `S9PM-FR-06` | T9R11 |
| `S9PM-FR-07` | T9R09, T9R10 |
| `S9PM-FR-08` | T9R03, T9R12 |
| `S9PM-FR-09` | T9R11 |
| `S9PM-FR-10` | T9R06, T9R13 |
| `S9PM-FR-11` | T9R15, T9R16 |
| `S9PM-FR-12` | T9R17 |
| `S9PM-FR-13` | T9R17 |
| `S9PM-FR-14` | T9R17 |
| `S9PM-FR-15` | T9R17 |
| `S9PM-FR-16` | T9R14 |
| `S9PM-FR-17` | T9R13, T9R16 |
| `S9PM-FR-18` | T9R05, T9R06, T9R07 |
| `S9PM-FR-19` | T9R20 |
| `S9PM-FR-20` | T9R21 |
| `S9PM-FR-21` | T9R22 |
| `S9PM-FR-22` | T9R24 |
| `S9PM-FR-23` | T9R07, T9R22, T9R25 |
| `S9PM-FR-24` | T9R18, T9R25 |
| `S9PM-FR-25` | T9R03, T9R19, `BLOCK-01` |
| `S9PM-FR-26` | T9R01, T9R19 |
| `S9PM-FR-27` | T9R01, T9R04, T9R21, T9R23 |
| `S9PM-FR-28` | T9R23, T9R25 |

## Documented interpretation notes

1. **`S9PM-FR-08` vs `S9PM-FR-09`.** `FR-08` restricts the T918 diff to inventory construction and non-emptiness; `FR-09` mandates a matcher-liveness control. The control is therefore placed **inside** the existing inventory case (no new case, case count stays `8`) and is reported as a mandated addition, while every other assertion in the file remains byte-identical.
2. **Measured baseline pattern count is 16.** It includes `problem[_-]?formulations?\.(ts|sql)$`. Any reduction (including to 15) is a STOP (`BLOCK-07`), not a reconciliation.
3. **`62` is not pinned.** The suite asserts `> 0` plus known-path containment (`S9PM-FR-05`, spec Open Decision 2); `62` appears only in the evidence report.
4. **Removal of three `origin/main` expressions is mandated, not weakening.** Each removed expression becomes a strictly stronger immutable-range assertion in the same hunk (exact equality preserved, not relaxed).
5. **Planning artifacts are excluded from the PR.** This is a user-mandated narrowing of `S9PM-FR-25(a)`; the change surface shrinks to exactly two files.