# Quickstart / Verification Guide — Slice 3 Evidence Core

**Status**: Design-time acceptance recipe. Do not run as proof until Implement exists.

## 1. Implement Gate

Before implementation:

```text
G1 Slice 1 merged main
G2 Slice 2 merged main
G3 main CI green
G4 Docs baseline reconciled
G5 provenance_source unchanged
G6 shared idempotency available
G7 Case RLS available
G8 Case-specific 404 semantics available
G9 OpenAPI generator available
G10 migration history clean
G11 branch rebased/reconciled
```

Any failure => BLOCKED.

## 2. Migration

Future command set must prove:

- empty DB migration replay PASS；
- enums exact；
- three tables exist；
- assertions/observations separate；
- RLS ENABLE + FORCE；
- runtime role NOBYPASSRLS；
- no DELETE privilege；
- source enum not duplicated。

## 3. Message Happy Path

1. Authenticate current Family manager.
2. Create/read an existing Case.
3. POST:

```json
{
  "idempotencyKey": "msg-demo-0001",
  "content": "我担心孩子晚上一直在玩手机。"
}
```

Expected:

- 201；
- response contains message id / caseId / authorPersonId / content / recordedAt；
- no familyId；
- `dialogue_messages` +1；
- assertions +0；
- observations +0；
- problem_formulations +0；
- ai_runs +0。

## 4. Replay

Repeat exact body + same key:

- same 201 body；
- same message id；
- message count unchanged；
- event/audit count unchanged。

## 5. Mismatch

Same key, different content:

- 409 IDEMPOTENCY_PAYLOAD_MISMATCH；
- no new message；
- original message unchanged。

## 6. Cross-Family

Family A actor calls Family B Case ID:

- HTTP 404 CASE_NOT_FOUND；
- no Case/Evidence fields；
- app role in Family A context sees 0 B rows；
- direct insert with family_id=B rejected。

## 7. Provenance

Create via internal test fixture:

```text
subject = child
source = guardian
source_kind = GUARDIAN_RELAY
kind = STATEMENT
```

Expected:

- remains STATEMENT；
- source != subject preserved；
- no FACT created。

## 8. Conflict

Record two conflicting source records in same conflict group.

Expected:

- both rows survive；
- both sources visible in DB/domain result；
- no winner field/result；
- no automatic FACT。

## 9. Unknown Observation

Record:

```text
value_state = UNKNOWN
content = NULL
```

Expected:

- round-trip UNKNOWN；
- content remains NULL；
- no 0 / false / "none" fill.

Repeat for NOT_COLLECTED / DECLINED / NOT_APPLICABLE.

## 10. Supersession

Record old Evidence, then new Evidence with `supersedes_id=old.id`.

Expected:

- 2 rows；
- old content/source/time unchanged；
- new references old；
- no DELETE。

## 11. Scope Audit

Route list must include exactly one Slice 3 public operation:

- POST /api/v1/cases/:id/messages

Must not include:

- /assertions
- /observations
- /assessments
- /problem-formulations new Slice 3 route
- /scene
- /participants
- /ai

## 12. OpenAPI

Run generator twice:

- generated output stable；
- `createCaseMessage` present；
- contract drift empty；
- generated files not hand-edited。

## 13. Full Regression

Required future verification:

- typecheck
- static guard
- domain tests
- db tests
- integration tests
- OpenAPI check
- empty migration replay
- governance validation
- CI all required jobs green

No skipped/expected-fail test may be counted as PASS.
