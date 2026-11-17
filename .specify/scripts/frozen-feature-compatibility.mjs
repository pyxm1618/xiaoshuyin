import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const FROZEN_FEATURE_REQUIRED_ARTIFACTS = Object.freeze([
  "spec.md",
  "plan.md",
  "checklist.md",
  "tasks.md",
]);

export const REVIEWED_FROZEN_FEATURE_SETS = new Map([
  [
    "016-psychological-behavioral-intervention-contract-authority-reconciliation",
    Object.freeze({
      "spec.md": "5bc22645af2008d6f774e39f57bae391fa2543c7",
      "plan.md": "41300acbce1fd973d478348185f5d8860f4da841",
      "checklist.md": "f35f31b93758eeb98a2c53cbae1dcdc1f5b6f837",
      "tasks.md": "76805596e6a3dff389317207d8e4c14040127698",
    }),
  ],
]);

function gitBlobSha(root, rel) {
  const bytes = fs.readFileSync(path.join(root, rel));
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest("hex");
}

export function isExactReviewedFrozenFeatureSet(
  root,
  featureName,
  dir,
  registry = REVIEWED_FROZEN_FEATURE_SETS
) {
  if (!(registry instanceof Map) || !registry.has(featureName)) return false;
  const expected = registry.get(featureName);
  if (
    typeof expected !== "object" ||
    expected === null ||
    Array.isArray(expected)
  ) {
    return false;
  }

  const required = [...FROZEN_FEATURE_REQUIRED_ARTIFACTS].sort();
  const actual = Object.keys(expected).sort();
  if (
    actual.length !== required.length ||
    actual.some((name, index) => name !== required[index])
  ) {
    return false;
  }

  return required.every((name) => {
    const expectedSha = expected[name];
    const rel = path.join(dir, name);
    return (
      typeof expectedSha === "string" &&
      /^[0-9a-f]{40}$/.test(expectedSha) &&
      fs.existsSync(path.join(root, rel)) &&
      gitBlobSha(root, rel) === expectedSha
    );
  });
}
