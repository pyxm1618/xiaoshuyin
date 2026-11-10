/**
 * T097 / T112 — OpenAPI semantic checker regression.
 *
 * The checker must NOT treat a `nullable + const` schema as equivalent to a
 * true `oneOf [const, null]` union. JSON Schema evaluates `const` against the
 * whole instance, so:
 *
 *   A: { type: string, const: candidate-binding-v1 }
 *   B: { type: [string, null], const: candidate-binding-v1 }
 *   C: { oneOf: [{ type: string, const: candidate-binding-v1 }, { type: null }] }
 *
 * are three different schemas (A accepts only the literal, B only the literal,
 * C accepts the literal or null). Folding the union into B is the false
 * equivalence fixed for F-06.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// @ts-expect-error - plain .mjs verification helper without type declarations
import { normalize } from '../../scripts/lib/openapi-normalize.mjs';

const ROOT = process.cwd();

function normalized(value: unknown): unknown {
  return normalize(value, { components: { schemas: {} } });
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

describe('OpenAPI semantic normalizer (T097)', () => {
  it('keeps const-only, nullable+const and a true null union pairwise distinct', () => {
    const constOnly = { type: 'string', const: 'candidate-binding-v1' };
    const nullableConst = { type: ['string', 'null'], const: 'candidate-binding-v1' };
    const trueUnion = {
      oneOf: [
        { type: 'string', const: 'candidate-binding-v1' },
        { type: 'null' },
      ],
    };

    const a = stable(normalized(constOnly));
    const b = stable(normalized(nullableConst));
    const c = stable(normalized(trueUnion));

    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('still folds a genuinely nullable string without const/enum', () => {
    expect(normalized({ anyOf: [{ type: 'string' }, { type: 'null' }] })).toEqual({
      type: ['string', 'null'],
    });
  });

  it('generated candidate-decision is the frozen three-branch decision union', () => {
    const generated = JSON.parse(
      readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
    ) as any;
    const schema = generated.components.schemas.BindingCandidateDecisionRequest;
    expect(Array.isArray(schema.oneOf)).toBe(true);
    expect(schema.oneOf).toHaveLength(3);

    const byDecision = new Map<string, any>(
      schema.oneOf.map((branch: any) => [branch.properties.decision.const, branch])
    );
    const affirm = byDecision.get('AFFIRM')!;
    const reject = byDecision.get('REJECT')!;
    const cancel = byDecision.get('CANCEL')!;

    expect(affirm.required).toContain('confirmationVersion');
    expect(affirm.properties.confirmationVersion).toMatchObject({
      type: 'string',
      const: 'candidate-binding-v1',
    });
    expect(reject.properties.confirmationVersion).toBeUndefined();
    expect(reject.required).not.toContain('confirmationVersion');
    expect(cancel.properties.confirmationVersion).toBeUndefined();
    expect(cancel.required).not.toContain('confirmationVersion');
    for (const branch of [affirm, reject, cancel]) {
      expect(branch.additionalProperties).toBe(false);
    }
  });

  it('generated contract exposes /pairing-decision and no attemptId selector route', () => {
    const generated = JSON.parse(
      readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
    ) as any;
    const paths = Object.keys(generated.paths);
    expect(paths).toContain('/api/v1/identity-bindings/pairing-decision');
    expect(paths).not.toContain('/api/v1/identity-bindings/{attemptId}/decision');
    expect(
      paths.filter((p) => p.startsWith('/api/v1/identity-bindings/'))
    ).toHaveLength(6);
  });

  it('generated pairing request is a strict two-branch decision union', () => {
    const generated = JSON.parse(
      readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
    ) as any;
    const schema = generated.components.schemas.BindingConfirmerDecisionRequest;
    expect(schema.oneOf).toHaveLength(2);
    const byDecision = new Map<string, any>(
      schema.oneOf.map((branch: any) => [branch.properties.decision.const, branch])
    );
    const affirm = byDecision.get('AFFIRM')!;
    const reject = byDecision.get('REJECT')!;
    expect(affirm.properties.targetConfirmed.const).toBe(true);
    expect(affirm.properties.candidateRecognized.const).toBe(true);
    expect(reject.properties.targetConfirmed.const).toBe(false);
    expect(reject.properties.candidateRecognized.const).toBe(false);
    expect(affirm.required).toContain('pairingChallenge');
    expect(reject.required).toContain('pairingChallenge');
    expect(affirm.properties.pairingChallenge.pattern).toBe('^[A-Za-z0-9_-]{192}$');
    expect(reject.properties.pairingChallenge.pattern).toBe('^[A-Za-z0-9_-]{192}$');
    for (const branch of [affirm, reject]) {
      expect(branch.required).toContain('confirmationVersion');
      expect(branch.properties.confirmationVersion.const).toBe(
        'second-party-recognition-v1'
      );
    }
  });

  it('generated candidate AFFIRM response carries the fixed 192-char challenge', () => {
    const generated = JSON.parse(
      readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
    ) as any;
    const schema = generated.components.schemas.BindingCandidatePairingResponse;
    expect(schema.required).toEqual(expect.arrayContaining(['binding', 'pairingChallenge']));
    expect(schema.properties.pairingChallenge.minLength).toBe(192);
    expect(schema.properties.pairingChallenge.maxLength).toBe(192);
    expect(schema.properties.pairingChallenge.pattern).toBe('^[A-Za-z0-9_-]{192}$');
  });

  it('a bad fixture that folds the true union is rejected by the comparator', () => {
    // `openapi-check` already proves the frozen YAML equals the generated
    // three-branch union, so the generated schema stands in for the frozen
    // shape here. A hand-shaped "nullable + const" replacement must not compare
    // equal to it.
    const generated = JSON.parse(
      readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
    ) as any;
    const frozenShape =
      generated.components.schemas.BindingCandidateDecisionRequest;

    const folded = {
      type: ['object', 'null'],
      const: 'candidate-binding-v1',
      additionalProperties: false,
    };
    expect(stable(normalize(frozenShape, generated))).not.toBe(
      stable(normalize(folded, { components: { schemas: {} } }))
    );
  });
});
describe('007 timestamp pattern integrity (S7-II-M02)', () => {
  const yaml = readFileSync(
    join(
      ROOT,
      'specs/007-case-primary-switch/contracts/case-primary-switch-api.openapi.yaml'
    ),
    'utf-8'
  );
  const frozenPatterns = [...yaml.matchAll(/pattern: '([^']+)'/g)]
    .map((match) => match[1])
    .filter((pattern) => pattern.includes('T(?:'));
  const generated = JSON.parse(
    readFileSync(join(ROOT, 'packages/generated/openapi.json'), 'utf-8')
  ) as unknown;

  function collectPatterns(node: unknown, acc = new Set<string>()): Set<string> {
    if (!node || typeof node !== 'object') return acc;
    if (typeof (node as any).pattern === 'string') acc.add((node as any).pattern);
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectPatterns(value, acc);
    }
    return acc;
  }

  const generatedPatterns = [...collectPatterns(generated)].filter((pattern) =>
    pattern.includes('T(?:')
  );

  it('frozen YAML declares exactly five timestamp patterns', () => {
    expect(frozenPatterns).toHaveLength(5);
  });

  it('frozen and generated timestamp pattern strings are identical', () => {
    expect(new Set(frozenPatterns)).toEqual(new Set(generatedPatterns));
  });

  it('accepts a real success timestamp in both schemas', () => {
    const sample = '2026-11-07T08:45:02.000Z';
    for (const pattern of [...frozenPatterns, ...generatedPatterns]) {
      expect(new RegExp(pattern).test(sample), pattern).toBe(true);
    }
  });

  it('rejects invalid timestamps in both schemas', () => {
    const invalid = [
      '2026-13-01T00:00:00Z',
      '2026-02-30T00:00:00Z',
      '2026-11-07',
      '2026-11-07T25:00:00Z',
    ];
    for (const value of invalid) {
      for (const pattern of [...frozenPatterns, ...generatedPatterns]) {
        expect(new RegExp(pattern).test(value), `${value} / ${pattern}`).toBe(false);
      }
    }
  });

  it('drops pattern by default and keeps it with keepPatterns', () => {
    expect(normalize({ pattern: '^a$' }, {})).toEqual({});
    expect(normalize({ pattern: '^a$' }, {}, { keepPatterns: true })).toEqual({
      pattern: '^a$',
    });
  });

  it('detects a drifted pattern as non-equivalent', () => {
    const frozen = normalize(
      { pattern: frozenPatterns[0] },
      {},
      { keepPatterns: true }
    );
    const drifted = { pattern: `${frozenPatterns[0]}x` };
    expect(stable(frozen)).not.toBe(
      stable(normalize(drifted, {}, { keepPatterns: true }))
    );
  });
});