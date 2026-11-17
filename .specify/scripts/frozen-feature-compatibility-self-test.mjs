import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FROZEN_FEATURE_REQUIRED_ARTIFACTS,
  REVIEWED_FROZEN_FEATURE_SETS,
  isExactReviewedFrozenFeatureSet,
} from "./frozen-feature-compatibility.mjs";

const root = process.cwd();
const feature =
  "016-psychological-behavioral-intervention-contract-authority-reconciliation";
const realDir = path.join("specs", feature);

function assert(value, message) {
  if (!value) throw new Error(message);
}

assert(
  isExactReviewedFrozenFeatureSet(root, feature, realDir),
  "exact Slice 16 frozen set must pass"
);

for (const inheritedLike of [
  "constructor",
  "toString",
  "valueOf",
  "__proto__",
  "hasOwnProperty",
]) {
  assert(
    !isExactReviewedFrozenFeatureSet(root, inheritedLike, realDir),
    inheritedLike + " must not enter frozen compatibility"
  );
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s16-governance-"));
try {
  const tempDir = path.join("specs", feature);
  fs.mkdirSync(path.join(tempRoot, tempDir), { recursive: true });
  for (const name of FROZEN_FEATURE_REQUIRED_ARTIFACTS) {
    fs.copyFileSync(
      path.join(root, realDir, name),
      path.join(tempRoot, tempDir, name)
    );
  }
  assert(
    isExactReviewedFrozenFeatureSet(tempRoot, feature, tempDir),
    "copied exact frozen set must pass"
  );

  fs.appendFileSync(path.join(tempRoot, tempDir, "tasks.md"), "\n");
  assert(
    !isExactReviewedFrozenFeatureSet(tempRoot, feature, tempDir),
    "single-byte drift must fall through"
  );

  fs.copyFileSync(
    path.join(root, realDir, "tasks.md"),
    path.join(tempRoot, tempDir, "tasks.md")
  );
  fs.rmSync(path.join(tempRoot, tempDir, "spec.md"));
  assert(
    !isExactReviewedFrozenFeatureSet(tempRoot, feature, tempDir),
    "missing spec must fail"
  );

  fs.copyFileSync(
    path.join(root, realDir, "spec.md"),
    path.join(tempRoot, tempDir, "spec.md")
  );
  fs.rmSync(path.join(tempRoot, tempDir, "plan.md"));
  assert(
    !isExactReviewedFrozenFeatureSet(tempRoot, feature, tempDir),
    "missing plan must fail"
  );

  const emptyRegistry = new Map([[feature, Object.freeze({})]]);
  assert(
    !isExactReviewedFrozenFeatureSet(root, feature, realDir, emptyRegistry),
    "empty expected artifact map must fail"
  );

  const partialRegistry = new Map([
    [
      feature,
      Object.freeze({
        "spec.md": REVIEWED_FROZEN_FEATURE_SETS.get(feature)["spec.md"],
      }),
    ],
  ]);
  assert(
    !isExactReviewedFrozenFeatureSet(root, feature, realDir, partialRegistry),
    "partial expected artifact map must fail"
  );

  const badTasksRegistry = new Map([
    [
      feature,
      Object.freeze({
        ...REVIEWED_FROZEN_FEATURE_SETS.get(feature),
        "tasks.md": "0".repeat(40),
      }),
    ],
  ]);
  assert(
    !isExactReviewedFrozenFeatureSet(root, feature, realDir, badTasksRegistry),
    "bad tasks blob must fail"
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Slice 16 frozen feature compatibility self-test PASS");
