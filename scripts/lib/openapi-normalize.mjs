/**
 * Lossless OpenAPI / JSON-Schema normalizer used by `openapi-check`.
 *
 * Only presentation-level metadata is dropped. Collection keywords (`oneOf`,
 * `anyOf`) keep their structure unless the union is a provably lossless
 * nullable wrapper. A `{ const }` or `{ enum }` member must NEVER be folded
 * into `type: [T, 'null']`: JSON Schema evaluates `const` / `enum` against the
 * whole instance, so `type: [string, null] + const: X` only accepts `X`, while
 * `oneOf: [{ const: X }, { type: null }]` also accepts `null`. Folding those
 * two forms makes the checker treat a TRUE null union as a nullable literal and
 * is exactly the false-equivalence F-06 fixes.
 */

const DROP_KEYS = new Set([
  '$schema',
  'title',
  'description',
  'example',
  'examples',
  'format',

  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
  'default',
  'deprecated',
  'propertyNames',
]);

export function resolveSchemaRef(refString, root) {
  const parts = refString.replace(/^#\//, '').split('/');
  let current = root;
  for (const part of parts) current = current?.[part];
  return current;
}

/** A union member whose value is constrained by `const` / `enum`. */
function isLiteralMember(node) {
  return (
    node !== null &&
    typeof node === 'object' &&
    (Object.prototype.hasOwnProperty.call(node, 'const') ||
      Object.prototype.hasOwnProperty.call(node, 'enum'))
  );
}

export function normalize(node, root, options = {}) {
  if (Array.isArray(node)) return node.map((item) => normalize(item, root, options));
  if (!node || typeof node !== 'object') return node;

  if (
    typeof node.$ref === 'string' &&
    node.$ref.startsWith('#/components/schemas/')
  ) {
    return normalize(resolveSchemaRef(node.$ref, root), root, options);
  }

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (DROP_KEYS.has(key) || key.startsWith('x-')) continue;
    if (key === 'pattern' && !options.keepPatterns) continue;

    if (key === 'allOf' && Array.isArray(value) && value.length === 1) {
      return normalize(value[0], root, options);
    }

    if ((key === 'anyOf' || key === 'oneOf') && Array.isArray(value)) {
      const items = value.map((item) => normalize(item, root, options));
      const nonNull = items.filter((item) => item && item.type !== 'null');
      const hasNull = items.some((item) => item && item.type === 'null');
      if (hasNull && nonNull.length === 1 && !isLiteralMember(nonNull[0])) {
        const base = { ...nonNull[0] };
        const baseType = base.type;
        out.type = Array.isArray(baseType)
          ? [...new Set([...baseType, 'null'])]
          : [baseType, 'null'];
        for (const [baseKey, baseValue] of Object.entries(base)) {
          if (baseKey !== 'type') out[baseKey] = baseValue;
        }
        continue;
      }
      out[key] = items;
      continue;
    }

    const normalized = normalize(value, root, options);
    out[key] =
      key === 'required' && Array.isArray(normalized)
        ? [...normalized].sort()
        : normalized;
  }

  // OpenAPI 3.0 `nullable: true` and JSON Schema's
  // `type: [T, 'null']` are equivalent for an unconstrained typed schema.
  // Canonicalize both to the JSON-Schema form so frozen OAS 3.0 documents can
  // be compared losslessly with Zod 4 generated schemas.
  if (out.nullable === true && out.type !== undefined && !isLiteralMember(out)) {
    const baseType = out.type;
    out.type = Array.isArray(baseType)
      ? [...new Set([...baseType, 'null'])]
      : [baseType, 'null'];
    delete out.nullable;
  }

  if (
    'additionalProperties' in out &&
    out.additionalProperties &&
    typeof out.additionalProperties === 'object' &&
    Object.keys(out.additionalProperties).length === 0
  ) {
    out.additionalProperties = true;
  }

  return out;
}