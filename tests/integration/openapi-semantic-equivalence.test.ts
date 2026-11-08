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