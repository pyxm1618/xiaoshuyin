import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface AcceptanceEvidence {
  readonly id: number;
  readonly scenario: string;
  readonly file: string;
  readonly needle: string;
}

/**
 * T1219 — one-to-one mechanical evidence registry.
 *
 * Each frozen acceptance ID binds to a concrete executable/static proof that is
 * part of canonical verify-all. This registry does not replace those tests; it
 * prevents acceptance evidence from becoming an informal checklist with gaps,
 * duplicate IDs or references to nonexistent proofs.
 */
const ACCEPTANCE_EVIDENCE: readonly AcceptanceEvidence[] = [
  { id: 1, scenario: 'A1001 broad device scope', file: 'tests/domain/digital-use-assessment-evidence-semantics.test.ts', needle: 'records broad devices, purpose-separated durations and functional impact' },
  { id: 2, scenario: 'Under-six fidelity', file: 'tests/domain/digital-use-assessment-evidence-semantics.test.ts', needle: 'does not invent an under-six Scene eligibility gate' },
  { id: 3, scenario: 'Purpose separation', file: 'tests/domain/digital-use-assessment-evidence-semantics.test.ts', needle: 'keeps purpose distributions distinguishable even when total duration is identical' },
  { id: 4, scenario: 'Duration-only negative', file: 'tests/scenes/digital-use/authority-regression.test.ts', needle: 'refuses total-duration-only and historical-band-only triage regardless of proposed outcome' },
  { id: 5, scenario: '01002 cardinality', file: 'tests/domain/digital-use-assessment-evidence-semantics.test.ts', needle: 'enforces 01002 max two selections and routes valid F priority' },
  { id: 6, scenario: '01002F priority', file: 'tests/scenes/digital-use/authority-regression.test.ts', needle: 'keeps 01002F→01005 and 01003F→01006 priority semantics' },
  { id: 7, scenario: '01003 cardinality', file: 'tests/domain/digital-use-assessment-evidence-semantics.test.ts', needle: 'enforces 01003 exactly one selection and preserves unresolved states' },
  { id: 8, scenario: '01003F priority', file: 'tests/scenes/digital-use/authority-regression.test.ts', needle: 'keeps 01002F→01005 and 01003F→01006 priority semantics' },
  { id: 9, scenario: 'A2001 advice path', file: 'tests/domain/digital-use-problem-formulation-branches.test.ts', needle: "choice: 'GENERAL_ADVICE'" },
  { id: 10, scenario: 'A2001 continue path', file: 'tests/domain/digital-use-problem-formulation-branches.test.ts', needle: "choice: 'CONTINUE_DIGITAL_USE'" },
  { id: 11, scenario: 'A2002 further-assessment path', file: 'tests/domain/digital-use-problem-formulation-branches.test.ts', needle: "choice: 'FURTHER_ASSESSMENT'" },
  { id: 12, scenario: '01004 decline', file: 'tests/domain/digital-use-supplemental-assessment.test.ts', needle: 'records explicit decline through Consent owner and routes only to decline terminal' },
  { id: 13, scenario: '01004 consent isolation', file: 'tests/domain/digital-use-supplemental-assessment.test.ts', needle: 'explicitly injects the PR #35 approved disclosure authority into the one Consent owner' },
  { id: 14, scenario: '01000 no invention', file: 'tests/domain/digital-use-supplemental-assessment.test.ts', needle: '01000 persists only the approved category boundary and truthful unavailable state' },
  { id: 15, scenario: 'A200401 negative node', file: 'tests/domain/digital-use-scene-read.test.ts', needle: 'keeps A200401 and fabricated identities non-addressable' },
  { id: 16, scenario: 'A2004 route fidelity', file: 'tests/domain/digital-use-problem-formulation-branches.test.ts', needle: 'A2004 preserves %s Evidence while applying the approved branch' },
  { id: 17, scenario: 'Unknown provenance fidelity', file: 'tests/domain/digital-use-problem-formulation-branches.test.ts', needle: 'A2006 and A2008 require A200401 context and preserve uncertainty' },
  { id: 18, scenario: 'A2005/A2006/A2008/A2009 fidelity', file: 'tests/domain/digital-use-problem-formulation-branches.test.ts', needle: 'A2009 never converts uncertainty into agreement' },
  { id: 19, scenario: 'A2007 timeline artifact / no scheduler', file: 'tests/domain/digital-use-timeline-summary.test.ts', needle: 'contains no scheduler/job/notification delivery implementation' },
  { id: 20, scenario: 'A2010 summary / no A3000 runtime', file: 'tests/domain/digital-use-timeline-summary.test.ts', needle: 'creates no A3000 state or downstream business truth in semantics' },
  { id: 21, scenario: 'Unknown/fabricated node', file: 'tests/domain/digital-use-scene-read.test.ts', needle: "resolveDigitalUseRuntimeNode('A999999')" },
  { id: 22, scenario: 'Unreachable node', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'rejects a manifest-valid but not-yet-reachable node read' },
  { id: 23, scenario: 'Client nextNode attack', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'rejects client route/package authority fields before business execution' },
  { id: 24, scenario: 'Cross-Family', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'anti-enumerates cross-Family access and keeps A200401 non-addressable' },
  { id: 25, scenario: 'Cross-Case Evidence', file: 'tests/domain/digital-use-scene-repository.test.ts', needle: 'rejects a cross-Case Evidence ref and validates A200401 marker through its Evidence refs' },
  { id: 26, scenario: 'Participant escalation', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'does not grant Assessment visibility to an ACTIVE Case Participant' },
  { id: 27, scenario: 'Safety Hold', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'Safety Hold preempts an ordinary node response without leaving Evidence' },
  { id: 28, scenario: 'Compliance block', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'fails closed when the current Slice 10 Compliance policy becomes unresolved' },
  { id: 29, scenario: 'Idempotent replay', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'expect(replay.json()).toEqual(first.json())' },
  { id: 30, scenario: 'Idempotency mismatch', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: "IDEMPOTENCY_PAYLOAD_MISMATCH" },
  { id: 31, scenario: 'Concurrent node response', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'allows only one winner for two concurrent responses at the same revision' },
  { id: 32, scenario: 'Primary switch race', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'a primary switch makes the old Assessment Case lose write authority' },
  { id: 33, scenario: 'Atomic injected failure', file: 'tests/integration/digital-use-runtime-hardening.test.ts', needle: 'rolls back Evidence + Scene CAS when a later event write is fault-injected' },
  { id: 34, scenario: 'PresentProblemFormulation handoff', file: 'tests/domain/digital-use-problem-formulation-handoff.test.ts', needle: 'delegates presentation to the Slice 8 caller-owned seam and never writes formulation SQL' },
  { id: 35, scenario: 'Full no-model canonical fixture', file: 'tests/scenes/digital-use/architecture-guard.test.ts', needle: 'accepts the canonical repository architecture' },
  { id: 36, scenario: 'Scope negative', file: 'tests/scenes/digital-use/architecture-guard.test.ts', needle: 'detects cross-tree second truth bypasses without flagging isolated node references' },

  { id: 37, scenario: '01002F only → 01005', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01002 F'" },
  { id: 38, scenario: '01003F only after valid non-F → 01006', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01003 F'" },
  { id: 39, scenario: 'both F → 01005 and preserve 01003F', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: '01002 F wins when both F are valid and family F remains in input Evidence' },
  { id: 40, scenario: '01002 missing → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01002 missing'" },
  { id: 41, scenario: '01002 NOT_COLLECTED → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01002 NOT_COLLECTED'" },
  { id: 42, scenario: '01002 DECLINED → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01002 DECLINED'" },
  { id: 43, scenario: '01002 conflict → BLOCKED', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01002 conflict'" },
  { id: 44, scenario: '01003 missing → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01003 missing'" },
  { id: 45, scenario: '01003 NOT_COLLECTED → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01003 NOT_COLLECTED'" },
  { id: 46, scenario: '01003 DECLINED → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01003 DECLINED'" },
  { id: 47, scenario: '01003 conflict → BLOCKED', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['01003 conflict'" },
  { id: 48, scenario: 'duration-only → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['duration only'" },
  { id: 49, scenario: 'clean low-impact → A2001', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['clean low-impact'" },
  { id: 50, scenario: 'negative direct impact + other needs positive → A2002', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['other-needs positive'" },
  { id: 51, scenario: 'negative direct impact + other-needs material unresolved → A2002', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['material unknown other needs'" },
  { id: 52, scenario: 'positive direct impact → A2003', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: 'requires positive direct-impact proof for A2003 and never duration-only' },
  { id: 53, scenario: 'positive direct impact + non-severe other needs → A2003 preserving other needs', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['mixed positive + other needs'" },
  { id: 54, scenario: 'direct-impact missing / NOT_COLLECTED / DECLINED / UNKNOWN → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: 'direct-impact %s without a usable current value stays INSUFFICIENT' },
  { id: 55, scenario: 'direct-impact conflict → BLOCKED', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['direct impact conflict'" },
  { id: 56, scenario: 'no normal predicate provable → INSUFFICIENT', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: "['no normal predicate proven'" },
  { id: 57, scenario: 'no default / absence outcome', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: 'never defaults absence or unresolved evidence into a normal triage outcome' },
  { id: 58, scenario: 'repeat identical fixture deterministic / no model-network truth', file: 'tests/scenes/digital-use/integrated-triage.test.ts', needle: 'is deterministic and has no model/RAG/network truth dependency' },
] as const;

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);

describe('T1219 Slice 12 frozen acceptance evidence registry', () => {
  it('is exactly 36 original + 22 Integrated Triage = 58 unique ordered acceptance IDs', () => {
    expect(ACCEPTANCE_EVIDENCE).toHaveLength(58);
    expect(ACCEPTANCE_EVIDENCE.map((entry) => entry.id)).toEqual(
      Array.from({ length: 58 }, (_, index) => index + 1)
    );
    expect(new Set(ACCEPTANCE_EVIDENCE.map((entry) => entry.id)).size).toBe(58);
    expect(new Set(ACCEPTANCE_EVIDENCE.map((entry) => entry.scenario)).size).toBe(58);
    expect(ACCEPTANCE_EVIDENCE.filter((entry) => entry.id <= 36)).toHaveLength(36);
    expect(ACCEPTANCE_EVIDENCE.filter((entry) => entry.id >= 37)).toHaveLength(22);
  });

  it.each(ACCEPTANCE_EVIDENCE)(
    'AS$id $scenario has a concrete canonical verify-all proof',
    ({ file, needle }) => {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      expect(source, `${file} must contain acceptance proof marker: ${needle}`).toContain(needle);
    }
  );
});
