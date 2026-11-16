import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const AUTHORITY_DOCS = Object.freeze([
  "Docs/总产品需求.md",
  "Docs/V1产品需求.md",
  "Docs/总体技术架构.md",
  "Docs/V1技术设计.md",
]);

export const AUTHORITY_SNAPSHOT_PATH = ".specify/authority-inputs.json";

export function gitBlobSha(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto
    .createHash("sha1")
    .update(header)
    .update(buffer)
    .digest("hex");
}

export function buildAuthoritySnapshot(root) {
  return {
    schemaVersion: 1,
    algorithm: "git-blob-sha1",
    authorityInputs: AUTHORITY_DOCS.map((rel) => ({
      path: rel,
      blobSha: gitBlobSha(fs.readFileSync(path.join(root, rel))),
    })),
  };
}

export function writeAuthoritySnapshot(root) {
  const target = path.join(root, AUTHORITY_SNAPSHOT_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const snapshot = buildAuthoritySnapshot(root);
  fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

export function validateAuthoritySnapshot(root, snapshot) {
  const errors = [];
  if (!snapshot || snapshot.schemaVersion !== 1) {
    errors.push("Authority input snapshot schemaVersion must be 1");
    return errors;
  }
  if (snapshot.algorithm !== "git-blob-sha1") {
    errors.push("Authority input snapshot algorithm must be git-blob-sha1");
    return errors;
  }
  if (!Array.isArray(snapshot.authorityInputs)) {
    errors.push("Authority input snapshot authorityInputs must be an array");
    return errors;
  }

  const expectedPaths = [...AUTHORITY_DOCS];
  const actualPaths = snapshot.authorityInputs.map((entry) => entry?.path);
  if (
    actualPaths.length !== expectedPaths.length ||
    actualPaths.some((value, index) => value !== expectedPaths[index])
  ) {
    errors.push(
      `Authority input snapshot must bind exactly: ${expectedPaths.join(", ")}`
    );
    return errors;
  }

  for (const entry of snapshot.authorityInputs) {
    if (typeof entry.blobSha !== "string" || !/^[0-9a-f]{40}$/.test(entry.blobSha)) {
      errors.push(`Authority input snapshot has invalid blobSha for ${entry.path}`);
      continue;
    }
    const target = path.join(root, entry.path);
    if (!fs.existsSync(target)) {
      errors.push(`Authority input missing: ${entry.path}`);
      continue;
    }
    const actual = gitBlobSha(fs.readFileSync(target));
    if (actual !== entry.blobSha) {
      errors.push(
        `Authority input drift: ${entry.path} expected ${entry.blobSha} actual ${actual}`
      );
    }
  }

  return errors;
}
