import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface EvidenceRef {
  readonly file: string;
  readonly anchor: string;
}

interface AcceptanceEvidence {
  readonly id: string;
  readonly evidence: readonly EvidenceRef[];
}

const FAMILY_RUNTIME =
  'tests/integration/digital-use-family-alliance-runtime.test.ts';
const FAMILY_GOV =
  'tests/scenes/digital-use/family-alliance-governance.test.ts';
const FAMILY_DB =
  'tests/db/digital-use-family-alliance-runtime-schema.test.ts';

const acceptance: readonly AcceptanceEvidence[] = [
  { id: 'AS-01', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-01..AS-13 executes legal entry' }] },
  { id: 'AS-02', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-01..AS-13 executes legal entry' }, { file: FAMILY_GOV, anchor: 'FA-GOV-05 feasibility' }] },
  { id: 'AS-03', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-03/06/09/38 preserves A3000' }] },
  { id: 'AS-04', evidence: [{ file: FAMILY_RUNTIME, anchor: 'A3002 is legal while A3001 remains incomplete' }, { file: FAMILY_GOV, anchor: 'FA-GOV-03 preserves reciprocal A3001/A3002 parallel topology' }] },
  { id: 'AS-05', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-05/31/32/33 gives stable idempotent A3002 semantics' }] },
  { id: 'AS-06', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-03/06/09/38 preserves A3000' }] },
  { id: 'AS-07', evidence: [{ file: FAMILY_RUNTIME, anchor: "kind: 'FEASIBILITY'" }, { file: FAMILY_GOV, anchor: 'FA-GOV-05 feasibility' }] },
  { id: 'AS-08', evidence: [{ file: FAMILY_RUNTIME, anchor: "kind: 'PROGRESS'" }] },
  { id: 'AS-09', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-03/06/09/38 preserves A3000' }] },
  { id: 'AS-10', evidence: [{ file: FAMILY_GOV, anchor: 'FA-GOV-01 protects the exact 43-node canonical inventory' }] },
  { id: 'AS-11', evidence: [{ file: FAMILY_GOV, anchor: 'FA-GOV-02 retains A3033' }] },
  { id: 'AS-12', evidence: [{ file: FAMILY_GOV, anchor: 'A3090-A3093' }] },
  { id: 'AS-13', evidence: [{ file: FAMILY_GOV, anchor: 'A3111 exactly' }, { file: FAMILY_GOV, anchor: 'no score/cutoff engine' }] },
  { id: 'AS-14', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-14/15 rejects fabricated target codes' }] },
  { id: 'AS-15', evidence: [{ file: FAMILY_RUNTIME, anchor: 'client-owned next-node control' }, { file: FAMILY_GOV, anchor: 'no local topology declarations exist' }] },
  { id: 'AS-16', evidence: [{ file: FAMILY_GOV, anchor: 'explicit unknown/declined states' }] },
  { id: 'AS-17', evidence: [{ file: FAMILY_GOV, anchor: 'explicit unknown/declined states' }] },
  { id: 'AS-18', evidence: [{ file: FAMILY_GOV, anchor: "challengeResistance: { state: 'CONFLICT' }" }] },
  { id: 'AS-19', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-19:' }] },
  { id: 'AS-20', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-20..AS-24 authorization, isolation and source fidelity fail closed' }] },
  { id: 'AS-21', evidence: [{ file: FAMILY_RUNTIME, anchor: 'crossFamily' }, { file: FAMILY_DB, anchor: 'enables and forces RLS' }] },
  { id: 'AS-22', evidence: [{ file: FAMILY_RUNTIME, anchor: 'Wrong-Case/Evidence/target references' }] },
  { id: 'AS-23', evidence: [{ file: FAMILY_RUNTIME, anchor: 'participantAttempt' }] },
  { id: 'AS-24', evidence: [{ file: FAMILY_RUNTIME, anchor: 'forgedSubject' }, { file: FAMILY_GOV, anchor: 'FA-GOV-10 substantive Evidence preserves actor source identity' }] },
  { id: 'AS-25', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-25 Safety Hold blocks entry' }] },
  { id: 'AS-26', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-26 Safety race wins before Family Alliance commit' }] },
  { id: 'AS-27', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-27/28 Compliance publication race' }] },
  { id: 'AS-28', evidence: [{ file: FAMILY_RUNTIME, anchor: 'UNKNOWN policy fail closed' }, { file: 'tests/domain/compliance-feature-policy-evaluator.test.ts', anchor: 'missing / future-only / expired-only all fail closed as POLICY_MISSING' }] },
  { id: 'AS-29', evidence: [{ file: FAMILY_RUNTIME, anchor: 'HX-07 Consent revoke race serializes against Family Alliance processing' }, { file: 'tests/integration/consent-revoke.test.ts', anchor: 'T058: gate BLOCK after revoke' }, { file: 'tests/domain/compliance-age-consent-composition.test.ts', anchor: 'revoked consent is invalid' }] },
  { id: 'AS-30', evidence: [{ file: FAMILY_RUNTIME, anchor: 'Safety Hold blocks entry without Evidence/artifact/idempotency residue' }, { file: FAMILY_RUNTIME, anchor: 'Compliance publication race and UNKNOWN policy fail closed' }] },
  { id: 'AS-31', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-05/31/32/33 gives stable idempotent A3002 semantics' }] },
  { id: 'AS-32', evidence: [{ file: FAMILY_RUNTIME, anchor: 'IDEMPOTENCY_PAYLOAD_MISMATCH' }] },
  { id: 'AS-33', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-33 concurrent A3002 writes cannot both become current' }] },
  { id: 'AS-34', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-34 concurrent target revisions cannot last-write-win' }] },
  { id: 'AS-35', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-35 primary-case race fails stale Family Alliance progression' }] },
  { id: 'AS-36', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-36 stale package token fails closed' }] },
  { id: 'AS-37', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-37 fault injection proves atomic rollback at seven business boundaries' }, { file: FAMILY_RUNTIME, anchor: 'after target write' }] },
  { id: 'AS-38', evidence: [{ file: FAMILY_RUNTIME, anchor: 'AS-03/06/09/38 preserves A3000' }] },
  { id: 'AS-39', evidence: [{ file: FAMILY_GOV, anchor: 'contains no A400 implementation' }] },
  { id: 'AS-40', evidence: [{ file: FAMILY_GOV, anchor: 'A5001|A5002' }] },
  { id: 'AS-41', evidence: [{ file: FAMILY_GOV, anchor: 'bounded persistence is target Scene state, never Goal/Task truth' }, { file: FAMILY_DB, anchor: 'does not create forbidden Family Alliance or Phase-4 persistence' }] },
  { id: 'AS-42', evidence: [{ file: FAMILY_GOV, anchor: 'PlanVersion' }] },
  { id: 'AS-43', evidence: [{ file: FAMILY_GOV, anchor: 'goals|tasks|checkins|outcomes' }] },
  { id: 'AS-44', evidence: [{ file: FAMILY_GOV, anchor: 'AI/RAG authority' }, { file: 'tests/integration/digital-use-canonical-no-model.test.ts', anchor: 'without LLM, RAG, or network route truth' }] },
] as const;

describe('Slice 13 acceptance evidence map', () => {
  it('maps exactly AS-01 through AS-44 to executable repository evidence', () => {
    expect(acceptance).toHaveLength(44);
    expect(acceptance.map((entry) => entry.id)).toEqual(
      Array.from({ length: 44 }, (_, index) =>
        `AS-${String(index + 1).padStart(2, '0')}`
      )
    );

    for (const entry of acceptance) {
      expect(entry.evidence.length, entry.id).toBeGreaterThan(0);
      for (const evidence of entry.evidence) {
        const source = readFileSync(resolve(process.cwd(), evidence.file), 'utf8');
        expect(
          source.includes(evidence.anchor),
          `${entry.id} missing evidence anchor: ${evidence.file} :: ${evidence.anchor}`
        ).toBe(true);
      }
    }
  });

  it('keeps acceptance ownership inside approved Slice13 and upstream-owner test surfaces', () => {
    const allowed = new Set([
      FAMILY_RUNTIME,
      FAMILY_GOV,
      FAMILY_DB,
      'tests/domain/compliance-feature-policy-evaluator.test.ts',
      'tests/integration/consent-revoke.test.ts',
      'tests/domain/compliance-age-consent-composition.test.ts',
      'tests/integration/digital-use-canonical-no-model.test.ts',
    ]);
    for (const entry of acceptance) {
      for (const evidence of entry.evidence) {
        expect(allowed.has(evidence.file), `${entry.id}: ${evidence.file}`).toBe(true);
      }
    }
  });
});
