#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const validator = path.resolve(here, "..", "validate-change-governance.mjs");
const results = [];

function write(root, rel, content) {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function run(root, base, env = {}) {
  const r = spawnSync(process.execPath, [validator, "--base", base, "--head", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function commit(root, message) {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

function blobSha(content) {
  const b = Buffer.from(content);
  return crypto.createHash("sha1").update(Buffer.from(`blob ${b.length}\0`)).update(b).digest("hex");
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-change-gov-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "governance-test@example.invalid"]);
  git(root, ["config", "user.name", "Governance Test"]);
  write(root, "README.md", "fixture\n");
  return root;
}

function record(name, expected, actual, mustContain = "") {
  let pass = actual.code === expected;
  if (pass && mustContain && !actual.out.includes(mustContain)) pass = false;
  results.push({ name, expected, actual: actual.code, pass, mustContain, out: actual.out });
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function addAuthorityBase(root) {
  const docs = [
    "Docs/总产品需求.md",
    "Docs/V1产品需求.md",
    "Docs/总体技术架构.md",
    "Docs/V1技术设计.md",
  ];
  const authorityInputs = [];
  for (const rel of docs) {
    const content = `authority ${rel}\n`;
    write(root, rel, content);
    authorityInputs.push({ path: rel, blobSha: blobSha(content) });
  }
  write(root, ".specify/authority-inputs.json", JSON.stringify({
    schemaVersion: 1,
    algorithm: "git-blob-sha1",
    authorityInputs,
  }, null, 2) + "\n");
}

// G1-A: product implementation without binding must fail.
{
  const root = project();
  write(root, "specs/001-fixture/spec.md", "# fixture\n");
  const base = commit(root, "base");
  write(root, "packages/domain/src/fixture.ts", "export const fixture = 1;\n");
  commit(root, "implementation without binding");
  record("G1-A production implementation without authoritative binding fails", 1, run(root, base), "Exactly one changed .specify/change-bindings");
  cleanup(root);
}

// G1-B: binding to a missing spec must fail.
{
  const root = project();
  const base = commit(root, "base");
  write(root, "packages/domain/src/new-feature.ts", "export const value = 1;\n");
  write(root, ".specify/change-bindings/new-feature.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "new-feature",
    classification: "FEATURE_IMPLEMENTATION",
    featureBindings: [{
      feature: "099-missing",
      specPath: "specs/099-missing",
      implementationPaths: ["packages/domain/src/new-feature.ts"],
    }],
  }, null, 2) + "\n");
  commit(root, "new feature missing spec");
  record("G1-B new feature implementation with missing spec fails", 1, run(root, base), "has no authoritative spec.md");
  cleanup(root);
}

// G1-C: existing feature with an exact binding passes.
{
  const root = project();
  write(root, "specs/001-fixture/spec.md", "# fixture\n");
  const base = commit(root, "base");
  write(root, "packages/domain/src/fixture.ts", "export const fixture = 1;\n");
  write(root, ".specify/change-bindings/fixture.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "fixture-implementation",
    classification: "FEATURE_IMPLEMENTATION",
    featureBindings: [{
      feature: "001-fixture",
      specPath: "specs/001-fixture",
      implementationPaths: ["packages/domain/src/fixture.ts"],
    }],
  }, null, 2) + "\n");
  commit(root, "bound implementation");
  record("G1-C existing feature implementation with exact spec binding passes", 0, run(root, base));
  cleanup(root);
}

// G1-D: non-product repository infrastructure requires a finite exemption class.
{
  const root = project();
  const base = commit(root, "base");
  write(root, "tooling/config.json", "{}\n");
  write(root, ".specify/change-bindings/tooling.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "tooling-update",
    classification: "REPOSITORY_INFRASTRUCTURE",
    exemptionClass: "BUILD_TOOLING",
    paths: ["tooling/config.json"],
  }, null, 2) + "\n");
  commit(root, "valid infrastructure exemption");
  record("G1-D pure infrastructure change with controlled exemption passes", 0, run(root, base));
  cleanup(root);
}

// G2-A: Authority change + refreshed snapshot but no impact declaration must fail.
{
  const root = project();
  addAuthorityBase(root);
  const base = commit(root, "authority base");
  const next = "authority revised\n";
  write(root, "Docs/V1产品需求.md", next);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, ".specify/authority-inputs.json"), "utf8"));
  snapshot.authorityInputs.find((x) => x.path === "Docs/V1产品需求.md").blobSha = blobSha(next);
  write(root, ".specify/authority-inputs.json", JSON.stringify(snapshot, null, 2) + "\n");
  commit(root, "hash only");
  record("G2-A Authority change plus hash refresh only fails", 1, run(root, base), "Authority Docs changed: exactly one changed");
  cleanup(root);
}

// G2-B/C: empty affecting declaration is not a convergence proof.
{
  const root = project();
  addAuthorityBase(root);
  const base = commit(root, "authority base");
  const oldContent = git(root, ["show", `${base}:Docs/V1产品需求.md`]) + "\n";
  const next = "authority revised\n";
  write(root, "Docs/V1产品需求.md", next);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, ".specify/authority-inputs.json"), "utf8"));
  snapshot.authorityInputs.find((x) => x.path === "Docs/V1产品需求.md").blobSha = blobSha(next);
  write(root, ".specify/authority-inputs.json", JSON.stringify(snapshot, null, 2) + "\n");
  write(root, ".specify/authority-impacts/empty.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "empty-impact",
    status: "CONVERGED",
    authorityChanges: [{
      path: "Docs/V1产品需求.md",
      previousBlobSha: blobSha(oldContent),
      newBlobSha: blobSha(next),
    }],
    impact: {
      classification: "AFFECTS_EXISTING_FEATURES",
      affectedSpecs: [],
      requiredArtifacts: [],
    },
  }, null, 2) + "\n");
  commit(root, "empty impact");
  record("G2-B/C Authority change with empty affected downstream fails", 1, run(root, base), "requires non-empty affectedSpecs");
  cleanup(root);
}

// G2-C2: declared downstream must actually change in the same convergence change.
{
  const root = project();
  addAuthorityBase(root);
  write(root, "specs/001-fixture/spec.md", "# existing spec\n");
  write(root, "tests/downstream.test.ts", "export {};\n");
  const base = commit(root, "authority base");
  const previous = git(root, ["show", `${base}:Docs/V1产品需求.md`]) + "\n";
  const next = "authority revised\n";
  write(root, "Docs/V1产品需求.md", next);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, ".specify/authority-inputs.json"), "utf8"));
  snapshot.authorityInputs.find((x) => x.path === "Docs/V1产品需求.md").blobSha = blobSha(next);
  write(root, ".specify/authority-inputs.json", JSON.stringify(snapshot, null, 2) + "\n");
  write(root, ".specify/authority-impacts/incomplete.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "incomplete-downstream",
    status: "CONVERGED",
    authorityChanges: [{
      path: "Docs/V1产品需求.md",
      previousBlobSha: blobSha(previous),
      newBlobSha: blobSha(next),
    }],
    impact: {
      classification: "AFFECTS_EXISTING_FEATURES",
      affectedSpecs: ["specs/001-fixture"],
      requiredArtifacts: ["tests/downstream.test.ts"],
    },
  }, null, 2) + "\n");
  commit(root, "declared but unchanged downstream");
  record("G2-C declared spec/artifact without downstream delta fails", 1, run(root, base), "no file under it changed");
  cleanup(root);
}

// G2 valid convergence: exact Authority blobs + changed spec + required artifact.
{
  const root = project();
  addAuthorityBase(root);
  write(root, "specs/001-fixture/spec.md", "# existing spec\n");
  write(root, "tests/downstream.test.ts", "export const contract = 1;\n");
  const base = commit(root, "authority base");
  const previous = fs.readFileSync(path.join(root, "Docs/V1产品需求.md"));
  const next = "authority revised with feature impact\n";
  write(root, "Docs/V1产品需求.md", next);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, ".specify/authority-inputs.json"), "utf8"));
  snapshot.authorityInputs.find((x) => x.path === "Docs/V1产品需求.md").blobSha = blobSha(next);
  write(root, ".specify/authority-inputs.json", JSON.stringify(snapshot, null, 2) + "\n");
  write(root, "specs/001-fixture/spec.md", "# existing spec\n\nconverged revision\n");
  write(root, "tests/downstream.test.ts", "export const contract = 2;\n");
  write(root, ".specify/authority-impacts/valid.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "valid-downstream",
    status: "CONVERGED",
    authorityChanges: [{
      path: "Docs/V1产品需求.md",
      previousBlobSha: blobSha(previous),
      newBlobSha: blobSha(next),
    }],
    impact: {
      classification: "AFFECTS_EXISTING_FEATURES",
      affectedSpecs: ["specs/001-fixture"],
      requiredArtifacts: ["tests/downstream.test.ts"],
    },
  }, null, 2) + "\n");
  commit(root, "valid convergence");
  record("G2-D Authority change with valid downstream convergence passes", 0, run(root, base));
  cleanup(root);
}

// G2-D: legitimate metadata-only correction uses finite exemption contract.
{
  const root = project();
  addAuthorityBase(root);
  const base = commit(root, "authority base");
  const previous = fs.readFileSync(path.join(root, "Docs/总产品需求.md"));
  const next = "authority Docs/总产品需求.md\n\nmetadata typo corrected\n";
  write(root, "Docs/总产品需求.md", next);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, ".specify/authority-inputs.json"), "utf8"));
  snapshot.authorityInputs.find((x) => x.path === "Docs/总产品需求.md").blobSha = blobSha(next);
  write(root, ".specify/authority-inputs.json", JSON.stringify(snapshot, null, 2) + "\n");
  write(root, ".specify/authority-impacts/metadata.json", JSON.stringify({
    schemaVersion: 1,
    changeId: "metadata-correction",
    status: "CONVERGED",
    authorityChanges: [{
      path: "Docs/总产品需求.md",
      previousBlobSha: blobSha(previous),
      newBlobSha: blobSha(next),
    }],
    impact: {
      classification: "NO_DOWNSTREAM_IMPACT",
      affectedSpecs: [],
      requiredArtifacts: [],
      exemption: {
        kind: "REFERENCE_METADATA_CORRECTION",
        reviewPolicy: "INDEPENDENT_HUMAN_APPROVAL_REQUIRED",
      },
    },
  }, null, 2) + "\n");
  commit(root, "metadata-only authority correction");
  record("G2-E legitimate authority metadata correction with controlled exemption passes", 0, run(root, base));
  cleanup(root);
}

// G5: marking a task complete without evidence fails.
{
  const root = project();
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:test]\n");
  const base = commit(root, "task base");
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:test]\n");
  commit(root, "fake completion");
  record("G5-A fake task completion without evidence fails", 1, run(root, base), "completed tasks require");
  cleanup(root);
}

// G5: evidence-backed historical reconciliation passes.
{
  const root = project();
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:test]\n");
  write(root, "tests/proof.test.ts", "export const proof = true;\n");
  const base = commit(root, "implemented historical base");
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:test]\n");
  write(root, ".specify/task-evidence/001-fixture.json", JSON.stringify({
    schemaVersion: 1,
    taskFile: "specs/001-fixture/tasks.md",
    implementationPr: 1,
    implementationHeadSha: base,
    mergeCommitSha: base,
    taskIds: ["T001"],
    artifactPaths: ["tests/proof.test.ts"],
    ciRuns: [{ name: "CI", runId: 1, conclusion: "success", headSha: base }],
  }, null, 2) + "\n");
  commit(root, "evidence-backed reconciliation");
  record("G5-B evidence-backed historical task reconciliation passes", 0, run(root, base));
  cleanup(root);
}

// G8: an agent/connector-created historical label cannot replace the missing impact contract.
{
  const root = project();
  addAuthorityBase(root);
  const base = commit(root, "authority base");
  const next = "authority revised\n";
  write(root, "Docs/V1技术设计.md", next);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, ".specify/authority-inputs.json"), "utf8"));
  snapshot.authorityInputs.find((x) => x.path === "Docs/V1技术设计.md").blobSha = blobSha(next);
  write(root, ".specify/authority-inputs.json", JSON.stringify(snapshot, null, 2) + "\n");
  commit(root, "label cannot approve authority");
  record(
    "G8 approved-docs-change label cannot manufacture Human Gate evidence",
    1,
    run(root, base, { PR_LABELS: "approved-docs-change" }),
    "Authority Docs changed: exactly one changed"
  );
  cleanup(root);
}

let failed = 0;
for (const item of results) {
  const status = item.pass ? "PASS" : "FAIL";
  if (!item.pass) failed += 1;
  console.log(`${status}  ${item.name} — expected exit ${item.expected}, got ${item.actual}`);
  if (!item.pass) {
    if (item.mustContain) console.log(`      expected output to contain: ${item.mustContain}`);
    console.log(item.out.trim().split("\n").map((line) => `      ${line}`).join("\n"));
  }
}
if (failed) {
  console.error(`\nChange governance adversarial self-test FAILED: ${failed}/${results.length}`);
  process.exit(1);
}
console.log(`\nChange governance adversarial self-test PASS: ${results.length}/${results.length}`);
