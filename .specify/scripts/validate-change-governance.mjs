#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const AUTHORITY_DOCS = Object.freeze([
  "Docs/总产品需求.md",
  "Docs/V1产品需求.md",
  "Docs/总体技术架构.md",
  "Docs/V1技术设计.md",
]);
const PRODUCT_PREFIXES = Object.freeze(["apps/", "packages/", "db/"]);
const FIXED_EXEMPT_PREFIXES = Object.freeze([
  ".specify/",
  ".github/",
  "specs/",
  "tests/",
  "scripts/",
  "Docs/",
]);
const FIXED_EXEMPT_FILES = new Set(["AGENTS.md"]);
const INFRA_EXEMPTION_CLASSES = new Set(["BUILD_TOOLING", "REPOSITORY_METADATA"]);
const NO_DOWNSTREAM_EXEMPTIONS = new Set([
  "TYPOGRAPHY_OR_FORMATTING",
  "REFERENCE_METADATA_CORRECTION",
  "GOVERNANCE_METADATA_CORRECTION",
]);

function parseArgs(argv) {
  const opts = {
    base: process.env.GOVERNANCE_BASE || "origin/main",
    head: process.env.GOVERNANCE_HEAD || "HEAD",
    changedFiles: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (argv[i + 1] === undefined) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return argv[i];
    };
    if (arg === "--base") opts.base = next();
    else if (arg === "--head") opts.head = next();
    else if (arg === "--changed-files") opts.changedFiles = next();
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: validate-change-governance.mjs [--base <ref>] [--head <ref>] [--changed-files <file>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: options.binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitOk(args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" }).status === 0;
}

function changedFiles(opts) {
  if (opts.changedFiles) {
    return fs.readFileSync(opts.changedFiles, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const out = git([
    "-c", "core.quotePath=false",
    "diff", "--name-only", "-z", "--diff-filter=ACDMRTUXB",
    `${opts.base}...${opts.head}`,
  ]);
  return out.split("\0").filter(Boolean);
}

function isProductPath(file) {
  return PRODUCT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isFixedExemptPath(file) {
  return FIXED_EXEMPT_FILES.has(file) ||
    FIXED_EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function readJson(rel, errors, label = rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  } catch (error) {
    errors.push(`${label}: invalid or unreadable JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function gitBlobSha(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash("sha1").update(header).update(buffer).digest("hex");
}

function blobAt(ref, rel) {
  return git(["show", `${ref}:${rel}`], { binary: true });
}

function currentBlobSha(rel) {
  return gitBlobSha(fs.readFileSync(path.join(root, rel)));
}

function assertExactSet(actualValues, expectedValues, label, errors) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    errors.push(`${label}: expected [${expected.join(", ")}], got [${actual.join(", ")}]`);
  }
}

function validateChangeBinding(changed, errors) {
  const productChanged = changed.filter(isProductPath).sort();
  const unknownChanged = changed.filter((file) => !isProductPath(file) && !isFixedExemptPath(file)).sort();
  const bindingFiles = changed.filter((file) => /^\.specify\/change-bindings\/[^/]+\.json$/.test(file));

  if (productChanged.length === 0 && unknownChanged.length === 0) {
    if (bindingFiles.length > 0) {
      errors.push("Change binding manifest changed even though no product or unclassified repository path changed.");
    }
    return;
  }

  if (bindingFiles.length !== 1) {
    errors.push(
      `Exactly one changed .specify/change-bindings/*.json manifest is required when product/unclassified paths change; found ${bindingFiles.length}.`
    );
    return;
  }

  const manifest = readJson(bindingFiles[0], errors, "Change binding manifest");
  if (!manifest) return;
  if (manifest.schemaVersion !== 1) errors.push("Change binding manifest schemaVersion must be 1.");
  if (typeof manifest.changeId !== "string" || !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(manifest.changeId)) {
    errors.push("Change binding manifest changeId is missing or invalid.");
  }

  if (productChanged.length > 0) {
    if (manifest.classification !== "FEATURE_IMPLEMENTATION") {
      errors.push("Product implementation changes require classification FEATURE_IMPLEMENTATION.");
      return;
    }
    if (!Array.isArray(manifest.featureBindings) || manifest.featureBindings.length === 0) {
      errors.push("FEATURE_IMPLEMENTATION requires non-empty featureBindings.");
      return;
    }

    const boundPaths = [];
    for (const [index, binding] of manifest.featureBindings.entries()) {
      const prefix = `featureBindings[${index}]`;
      if (typeof binding?.feature !== "string" || !binding.feature) {
        errors.push(`${prefix}.feature is required.`);
      }
      if (typeof binding?.specPath !== "string" || !/^specs\/[^/]+$/.test(binding.specPath)) {
        errors.push(`${prefix}.specPath must be an authoritative specs/<feature> directory.`);
      } else {
        const expectedFeature = path.posix.basename(binding.specPath);
        if (binding.feature !== expectedFeature) {
          errors.push(`${prefix}.feature must equal spec directory basename "${expectedFeature}".`);
        }
        if (!fs.existsSync(path.join(root, binding.specPath, "spec.md"))) {
          errors.push(`${prefix}.specPath has no authoritative spec.md: ${binding.specPath}`);
        }
      }
      if (!Array.isArray(binding?.implementationPaths) || binding.implementationPaths.length === 0) {
        errors.push(`${prefix}.implementationPaths must be non-empty.`);
        continue;
      }
      for (const rel of binding.implementationPaths) {
        if (typeof rel !== "string" || !isProductPath(rel)) {
          errors.push(`${prefix}.implementationPaths contains a non-product path: ${String(rel)}`);
          continue;
        }
        boundPaths.push(rel);
      }
    }

    if (new Set(boundPaths).size !== boundPaths.length) {
      errors.push("Product implementation path is bound more than once; bindings must be exact and unambiguous.");
    }
    assertExactSet(boundPaths, productChanged, "Product implementation binding", errors);
    if (unknownChanged.length > 0) {
      errors.push(`FEATURE_IMPLEMENTATION cannot absorb unclassified repository paths: ${unknownChanged.join(", ")}`);
    }
    return;
  }

  if (manifest.classification !== "REPOSITORY_INFRASTRUCTURE") {
    errors.push("Unclassified non-product paths require classification REPOSITORY_INFRASTRUCTURE.");
    return;
  }
  if (!INFRA_EXEMPTION_CLASSES.has(manifest.exemptionClass)) {
    errors.push(`REPOSITORY_INFRASTRUCTURE exemptionClass must be one of: ${[...INFRA_EXEMPTION_CLASSES].join(", ")}`);
  }
  if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) {
    errors.push("REPOSITORY_INFRASTRUCTURE requires non-empty paths.");
    return;
  }
  if (manifest.paths.some((rel) => isProductPath(rel))) {
    errors.push("REPOSITORY_INFRASTRUCTURE cannot exempt product implementation paths.");
  }
  assertExactSet(manifest.paths, unknownChanged, "Repository infrastructure exemption", errors);
}

function validateAuthorityImpact(changed, opts, errors) {
  const authorityChanged = changed.filter((file) => AUTHORITY_DOCS.includes(file)).sort();
  const impactFiles = changed.filter((file) => /^\.specify\/authority-impacts\/[^/]+\.json$/.test(file));

  if (authorityChanged.length === 0) {
    if (impactFiles.length > 0) {
      errors.push("Authority impact manifest changed without an Authority Doc change; reusable/pre-seeded impact declarations are forbidden.");
    }
    return;
  }

  if (!changed.includes(".specify/authority-inputs.json")) {
    errors.push("Authority Docs changed but .specify/authority-inputs.json was not refreshed in the same change.");
  }
  if (impactFiles.length !== 1) {
    errors.push(`Authority Docs changed: exactly one changed .specify/authority-impacts/*.json declaration is required; found ${impactFiles.length}.`);
    return;
  }

  const manifest = readJson(impactFiles[0], errors, "Authority impact manifest");
  if (!manifest) return;
  if (manifest.schemaVersion !== 1) errors.push("Authority impact manifest schemaVersion must be 1.");
  if (manifest.status !== "CONVERGED") errors.push('Authority impact manifest status must be "CONVERGED".');
  if (typeof manifest.changeId !== "string" || !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(manifest.changeId)) {
    errors.push("Authority impact manifest changeId is missing or invalid.");
  }
  if (!Array.isArray(manifest.authorityChanges)) {
    errors.push("Authority impact manifest authorityChanges must be an array.");
    return;
  }

  const declaredPaths = manifest.authorityChanges.map((item) => item?.path);
  assertExactSet(declaredPaths, authorityChanged, "Authority impact changed document set", errors);

  for (const item of manifest.authorityChanges) {
    if (!item || !AUTHORITY_DOCS.includes(item.path)) continue;
    let previous;
    let next;
    try {
      previous = gitBlobSha(blobAt(opts.base, item.path));
      next = gitBlobSha(blobAt(opts.head, item.path));
    } catch (error) {
      errors.push(`Cannot resolve authority blobs for ${item.path}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (item.previousBlobSha !== previous) {
      errors.push(`Authority impact previousBlobSha mismatch for ${item.path}: expected ${previous}`);
    }
    if (item.newBlobSha !== next) {
      errors.push(`Authority impact newBlobSha mismatch for ${item.path}: expected ${next}`);
    }
    if (previous === next) errors.push(`Authority impact lists unchanged document: ${item.path}`);
  }

  const impact = manifest.impact;
  const allowed = new Set([
    "AFFECTS_EXISTING_FEATURES",
    "CREATES_FUTURE_REQUIREMENT",
    "GOVERNANCE_ONLY",
    "NO_DOWNSTREAM_IMPACT",
  ]);
  if (!impact || !allowed.has(impact.classification)) {
    errors.push("Authority impact classification is missing or invalid.");
    return;
  }

  const affectedSpecs = Array.isArray(impact.affectedSpecs) ? impact.affectedSpecs : [];
  const requiredArtifacts = Array.isArray(impact.requiredArtifacts) ? impact.requiredArtifacts : [];

  if (impact.classification === "AFFECTS_EXISTING_FEATURES" || impact.classification === "CREATES_FUTURE_REQUIREMENT") {
    if (affectedSpecs.length === 0) errors.push(`${impact.classification} requires non-empty affectedSpecs.`);
    if (requiredArtifacts.length === 0) errors.push(`${impact.classification} requires non-empty requiredArtifacts.`);

    for (const specPath of affectedSpecs) {
      if (typeof specPath !== "string" || !/^specs\/[^/]+$/.test(specPath)) {
        errors.push(`Invalid affected spec path: ${String(specPath)}`);
        continue;
      }
      if (!fs.existsSync(path.join(root, specPath, "spec.md"))) {
        errors.push(`Affected spec does not exist or has no spec.md: ${specPath}`);
      }
      if (!changed.some((file) => file.startsWith(`${specPath}/`))) {
        errors.push(`Affected spec declared but no file under it changed in this convergence change: ${specPath}`);
      }
    }

    for (const artifact of requiredArtifacts) {
      if (typeof artifact !== "string" || !artifact || artifact.startsWith("Docs/")) {
        errors.push(`Invalid required downstream artifact: ${String(artifact)}`);
        continue;
      }
      if (!changed.includes(artifact)) {
        errors.push(`Required downstream artifact was not changed in this convergence change: ${artifact}`);
      }
      if (!fs.existsSync(path.join(root, artifact))) {
        errors.push(`Required downstream artifact does not exist at HEAD: ${artifact}`);
      }
    }
    return;
  }

  if (affectedSpecs.length !== 0 || requiredArtifacts.length !== 0) {
    errors.push(`${impact.classification} must not declare affectedSpecs/requiredArtifacts; use an affecting classification when downstream work exists.`);
  }
  if (!impact.exemption || !NO_DOWNSTREAM_EXEMPTIONS.has(impact.exemption.kind)) {
    errors.push(
      `${impact.classification} requires a controlled exemption.kind: ${[...NO_DOWNSTREAM_EXEMPTIONS].join(", ")}`
    );
  }
  if (impact.exemption?.reviewPolicy !== "INDEPENDENT_HUMAN_APPROVAL_REQUIRED") {
    errors.push(`${impact.classification} requires exemption.reviewPolicy=INDEPENDENT_HUMAN_APPROVAL_REQUIRED.`);
  }
  const productChanged = changed.filter(isProductPath);
  if (productChanged.length > 0) {
    errors.push(`${impact.classification} cannot coexist with product implementation changes: ${productChanged.join(", ")}`);
  }
}

function parseTaskIds(content, checkedOnly = false) {
  const ids = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^- \[([ xX])\] (T\d{3,})\b/);
    if (!match) continue;
    if (checkedOnly && match[1] === " ") continue;
    ids.push(match[2]);
  }
  return ids;
}

function validateTaskCompletionEvidence(errors) {
  const specsRoot = path.join(root, "specs");
  if (!fs.existsSync(specsRoot)) return;

  const baselinePath = ".specify/legacy-task-completion-baseline.json";
  let baseline = { schemaVersion: 1, files: [] };
  if (fs.existsSync(path.join(root, baselinePath))) {
    baseline = readJson(baselinePath, errors, "Legacy task completion baseline") || baseline;
  }
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.files)) {
    errors.push("Legacy task completion baseline must have schemaVersion=1 and files[].");
    baseline = { schemaVersion: 1, files: [] };
  }

  const baselineByPath = new Map();
  for (const entry of baseline.files) {
    if (!entry || typeof entry.path !== "string" || !/^[0-9a-f]{40}$/.test(entry.blobSha || "")) {
      errors.push("Legacy task completion baseline contains an invalid entry.");
      continue;
    }
    if (baselineByPath.has(entry.path)) errors.push(`Duplicate legacy task baseline entry: ${entry.path}`);
    baselineByPath.set(entry.path, entry.blobSha);
  }

  for (const entry of fs.readdirSync(specsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const taskRel = `specs/${entry.name}/tasks.md`;
    const taskAbs = path.join(root, taskRel);
    if (!fs.existsSync(taskAbs)) continue;
    const content = fs.readFileSync(taskAbs, "utf8");
    const checkedIds = parseTaskIds(content, true);
    if (checkedIds.length === 0) continue;

    const baselineSha = baselineByPath.get(taskRel);
    if (baselineSha && currentBlobSha(taskRel) === baselineSha) continue;

    const evidenceRel = `.specify/task-evidence/${entry.name}.json`;
    if (!fs.existsSync(path.join(root, evidenceRel))) {
      errors.push(`${taskRel}: completed tasks require ${evidenceRel} unless the task file matches the finite legacy baseline.`);
      continue;
    }
    const evidence = readJson(evidenceRel, errors, `Task evidence for ${entry.name}`);
    if (!evidence) continue;
    if (evidence.schemaVersion !== 1) errors.push(`${evidenceRel}: schemaVersion must be 1.`);
    if (evidence.taskFile !== taskRel) errors.push(`${evidenceRel}: taskFile must equal ${taskRel}.`);
    if (!Number.isInteger(evidence.implementationPr) || evidence.implementationPr <= 0) {
      errors.push(`${evidenceRel}: implementationPr must be a positive integer.`);
    }
    for (const field of ["implementationHeadSha", "mergeCommitSha"]) {
      if (typeof evidence[field] !== "string" || !/^[0-9a-f]{40}$/.test(evidence[field])) {
        errors.push(`${evidenceRel}: ${field} must be a 40-char commit SHA.`);
      }
    }
    if (Array.isArray(evidence.taskIds)) {
      assertExactSet(evidence.taskIds, checkedIds, `${evidenceRel} checked task evidence`, errors);
    } else {
      errors.push(`${evidenceRel}: taskIds must be an array.`);
    }
    if (!Array.isArray(evidence.artifactPaths) || evidence.artifactPaths.length === 0) {
      errors.push(`${evidenceRel}: artifactPaths must be non-empty.`);
    } else {
      let substantive = false;
      for (const rel of evidence.artifactPaths) {
        if (typeof rel !== "string" || !fs.existsSync(path.join(root, rel))) {
          errors.push(`${evidenceRel}: evidence artifact does not exist: ${String(rel)}`);
          continue;
        }
        if (!rel.startsWith("specs/") && !rel.startsWith(".specify/")) substantive = true;
      }
      if (!substantive) errors.push(`${evidenceRel}: artifactPaths must include implementation/test/governance evidence outside specs/.specify.`);
    }
    if (!Array.isArray(evidence.ciRuns) || evidence.ciRuns.length === 0) {
      errors.push(`${evidenceRel}: ciRuns must be non-empty.`);
    } else {
      for (const run of evidence.ciRuns) {
        if (!Number.isInteger(run?.runId) || run.runId <= 0 || typeof run?.name !== "string") {
          errors.push(`${evidenceRel}: invalid ciRuns entry.`);
          continue;
        }
        if (run.conclusion !== "success") errors.push(`${evidenceRel}: CI evidence must record conclusion=success.`);
        if (run.headSha !== evidence.implementationHeadSha) {
          errors.push(`${evidenceRel}: CI run headSha must equal implementationHeadSha.`);
        }
      }
    }

    if (/^[0-9a-f]{40}$/.test(evidence.implementationHeadSha || "") &&
        !gitOk(["cat-file", "-e", `${evidence.implementationHeadSha}^{commit}`])) {
      errors.push(`${evidenceRel}: implementationHeadSha is not present in repository history.`);
    }
    if (/^[0-9a-f]{40}$/.test(evidence.mergeCommitSha || "")) {
      if (!gitOk(["cat-file", "-e", `${evidence.mergeCommitSha}^{commit}`])) {
        errors.push(`${evidenceRel}: mergeCommitSha is not present in repository history.`);
      } else if (!gitOk(["merge-base", "--is-ancestor", evidence.mergeCommitSha, "HEAD"])) {
        errors.push(`${evidenceRel}: mergeCommitSha is not an ancestor of current HEAD.`);
      }
    }
  }
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = [];
let changed = [];
try {
  changed = changedFiles(opts);
} catch (error) {
  console.error(`Cannot compute governance diff ${opts.base}...${opts.head}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log("Change governance");
console.log(`  revision range: ${opts.base}...${opts.head}`);
console.log(`  changed files: ${changed.length}`);
console.log(`  product implementation files: ${changed.filter(isProductPath).length}`);
console.log(`  authority docs changed: ${changed.filter((file) => AUTHORITY_DOCS.includes(file)).length}`);

validateChangeBinding(changed, errors);
validateAuthorityImpact(changed, opts, errors);
validateTaskCompletionEvidence(errors);

if (errors.length > 0) {
  console.error("Change governance FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Change governance PASS");
