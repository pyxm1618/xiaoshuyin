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
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
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
  const b = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return crypto.createHash("sha1").update(Buffer.from("blob " + b.length + "\0")).update(b).digest("hex");
}
function taskDigest(records) {
  return blobSha(records.map((r) => r.id + "\0" + r.verify).join("\n"));
}
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-change-gov-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "governance-test@example.invalid"]);
  git(root, ["config", "user.name", "Governance Test"]);
  write(root, "README.md", "fixture\n");
  return root;
}
function record(name, expected, actual, marker = "") {
  let pass = actual.code === expected;
  if (pass && marker && !actual.out.includes(marker)) pass = false;
  results.push({ name, expected, actual: actual.code, marker, pass, out: actual.out });
}
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}
function addFeature(root, feature, spec = "# spec\n") {
  write(root, "specs/" + feature + "/spec.md", spec);
}
function addOwnership(root, rules) {
  write(root, ".specify/implementation-ownership.json", JSON.stringify({
    schemaVersion: 1,
    resolution: "LONGEST_MATCH",
    rules,
  }, null, 2) + "\n");
}
function ownershipRule(id, kind, matchPath, ownershipKind, features) {
  return { id, match: { kind, path: matchPath }, ownership: { kind: ownershipKind, features } };
}
function addTaskProvenanceRegistry(root, sharedRemediations = []) {
  write(root, ".specify/task-provenance-registry.json", JSON.stringify({
    schemaVersion: 2,
    sharedRemediations,
  }, null, 2) + "\n");
}
function addAuthorityBase(root, targetUnits) {
  const docs = [
    "Docs/总产品需求.md",
    "Docs/V1产品需求.md",
    "Docs/总体技术架构.md",
    "Docs/V1技术设计.md",
  ];
  const contents = new Map();
  for (const rel of docs) {
    const content = rel === "Docs/V1产品需求.md"
      ? "# V1\n## Normative A\nold normative\n## Metadata\nold reference\n"
      : "# Authority\nbody " + rel + "\n";
    contents.set(rel, content);
    write(root, rel, content);
  }
  writeAuthoritySnapshot(root, contents);
  const documents = docs.map((rel) => ({
    path: rel,
    units: rel === "Docs/V1产品需求.md" ? targetUnits : [{
      id: "UNIT-" + rel,
      selector: { kind: "MARKDOWN_SECTION_SHALLOW", heading: "# Authority" },
      normative: true,
      lifecycle: "FUTURE_UNIMPLEMENTED",
      futureReason: "fixture future authority",
      downstreamBindings: [],
    }],
  }));
  write(root, ".specify/authority-unit-registry.json", JSON.stringify({
    schemaVersion: 2,
    documents,
  }, null, 2) + "\n");
}

function writeAuthoritySnapshot(root, overrideMap = null) {
  const docs = [
    "Docs/总产品需求.md",
    "Docs/V1产品需求.md",
    "Docs/总体技术架构.md",
    "Docs/V1技术设计.md",
  ];
  const authorityInputs = docs.map((rel) => {
    const content = overrideMap?.get(rel) ?? fs.readFileSync(path.join(root, rel));
    return { path: rel, blobSha: blobSha(content) };
  });
  write(root, ".specify/authority-inputs.json", JSON.stringify({
    schemaVersion: 1,
    algorithm: "git-blob-sha1",
    authorityInputs,
  }, null, 2) + "\n");
}
function refreshSnapshot(root) {
  writeAuthoritySnapshot(root);
}
function authorityUnits({ bind = true } = {}) {
  return [
    {
      id: "AUTH-V1-ROOT",
      selector: { kind: "MARKDOWN_SECTION_SHALLOW", heading: "# V1" },
      normative: true,
      lifecycle: "FUTURE_UNIMPLEMENTED",
      futureReason: "fixture future authority",
      downstreamBindings: [],
    },
    {
      id: "AUTH-A",
      selector: { kind: "MARKDOWN_SECTION_SHALLOW", heading: "## Normative A" },
      normative: true,
      lifecycle: bind ? "IMPLEMENTED" : "FUTURE_UNIMPLEMENTED",
      ...(bind ? {} : { futureReason: "fixture future authority" }),
      downstreamBindings: bind ? [{
        feature: "001-feature-a",
        specPath: "specs/001-feature-a",
        requirements: [{
          id: "FR-001",
          selector: { kind: "MARKDOWN_SECTION", heading: "## FR-001 Contract" },
          requiredArtifacts: ["tests/a.test.ts"],
        }],
      }] : [],
    },
    {
      id: "AUTH-METADATA",
      selector: { kind: "MARKDOWN_SECTION_SHALLOW", heading: "## Metadata" },
      normative: false,
      lifecycle: "NON_NORMATIVE",
      downstreamBindings: [],
      allowedNoImpactKinds: ["NON_NORMATIVE_METADATA"],
    },
  ];
}

function impactManifest(root, base, unitImpacts, changeId = "authority-test") {
  const prev = Buffer.from(execFileSync("git", ["show", base + ":Docs/V1产品需求.md"], { cwd: root }));
  const next = fs.readFileSync(path.join(root, "Docs/V1产品需求.md"));
  write(root, ".specify/authority-impacts/test.json", JSON.stringify({
    schemaVersion: 2,
    changeId,
    status: "CONVERGED",
    authorityChanges: [{
      path: "Docs/V1产品需求.md",
      previousBlobSha: blobSha(prev),
      newBlobSha: blobSha(next),
    }],
    unitImpacts,
  }, null, 2) + "\n");
}

// G1-A: production implementation without binding still fails.
{
  const root = project();
  addFeature(root, "010-compliance-feature-policy-foundation");
  addOwnership(root, [ownershipRule("compliance", "PREFIX", "packages/compliance/", "FEATURE", ["010-compliance-feature-policy-foundation"])]);
  const base = commit(root, "base");
  write(root, "packages/compliance/src/new.ts", "export const x = 1;\n");
  commit(root, "no binding");
  record("G1-A production implementation without binding fails", 1, run(root, base), "Exactly one changed .specify/change-bindings");
  cleanup(root);
}

// G1-C1: real production path cannot self-bind to unrelated existing spec.
{
  const root = project();
  addFeature(root, "010-compliance-feature-policy-foundation");
  addFeature(root, "001-family-identity-core");
  addOwnership(root, [ownershipRule("compliance", "PREFIX", "packages/compliance/", "FEATURE", ["010-compliance-feature-policy-foundation"])]);
  const base = commit(root, "base");
  write(root, "packages/compliance/src/new.ts", "export const x = 1;\n");
  write(root, ".specify/change-bindings/attack.json", JSON.stringify({
    schemaVersion: 2,
    changeId: "unrelated-spec",
    classification: "FEATURE_IMPLEMENTATION",
    featureBindings: [{
      feature: "001-family-identity-core",
      specPath: "specs/001-family-identity-core",
      implementationPaths: ["packages/compliance/src/new.ts"],
    }],
  }, null, 2) + "\n");
  commit(root, "attack");
  record("G1-C1 unrelated existing spec self-binding is rejected", 1, run(root, base), "Implementation ownership mismatch");
  cleanup(root);
}

// G1-C2/C3: shared ownership is finite; unauthorized fails, explicitly authorized passes.
{
  const root = project();
  addFeature(root, "010-compliance-feature-policy-foundation");
  addFeature(root, "011-digital-use-node-manifest-routing-foundation");
  addFeature(root, "001-family-identity-core");
  addOwnership(root, [ownershipRule("shared", "PREFIX", "packages/shared/", "SHARED", [
    "010-compliance-feature-policy-foundation",
    "011-digital-use-node-manifest-routing-foundation",
  ])]);
  const base = commit(root, "base");
  write(root, "packages/shared/new.ts", "export const x = 1;\n");
  write(root, ".specify/change-bindings/attack.json", JSON.stringify({
    schemaVersion: 2, changeId: "shared-attack", classification: "FEATURE_IMPLEMENTATION",
    featureBindings: [{ feature: "001-family-identity-core", specPath: "specs/001-family-identity-core", implementationPaths: ["packages/shared/new.ts"] }],
  }, null, 2) + "\n");
  commit(root, "unauthorized");
  record("G1-C2 shared production path rejects unauthorized feature", 1, run(root, base), "Implementation ownership mismatch");
  cleanup(root);
}
{
  const root = project();
  addFeature(root, "010-compliance-feature-policy-foundation");
  addFeature(root, "011-digital-use-node-manifest-routing-foundation");
  addOwnership(root, [ownershipRule("shared", "PREFIX", "packages/shared/", "SHARED", [
    "010-compliance-feature-policy-foundation",
    "011-digital-use-node-manifest-routing-foundation",
  ])]);
  const base = commit(root, "base");
  write(root, "packages/shared/new.ts", "export const x = 1;\n");
  write(root, ".specify/change-bindings/valid.json", JSON.stringify({
    schemaVersion: 2, changeId: "shared-valid", classification: "FEATURE_IMPLEMENTATION",
    featureBindings: [{ feature: "010-compliance-feature-policy-foundation", specPath: "specs/010-compliance-feature-policy-foundation", implementationPaths: ["packages/shared/new.ts"] }],
  }, null, 2) + "\n");
  commit(root, "authorized");
  record("G1-C3 explicitly authorized shared ownership passes", 0, run(root, base), "Change governance PASS");
  cleanup(root);
}

// G1-C4: unknown production path fails closed.
{
  const root = project();
  addFeature(root, "010-compliance-feature-policy-foundation");
  addOwnership(root, [ownershipRule("known", "PREFIX", "packages/known/", "FEATURE", ["010-compliance-feature-policy-foundation"])]);
  const base = commit(root, "base");
  write(root, "packages/unknown/new.ts", "export const x = 1;\n");
  write(root, ".specify/change-bindings/unknown.json", JSON.stringify({
    schemaVersion: 2, changeId: "unknown-path", classification: "FEATURE_IMPLEMENTATION",
    featureBindings: [{ feature: "010-compliance-feature-policy-foundation", specPath: "specs/010-compliance-feature-policy-foundation", implementationPaths: ["packages/unknown/new.ts"] }],
  }, null, 2) + "\n");
  commit(root, "unknown");
  record("G1-C4 unknown production path fails closed", 1, run(root, base), "No registered implementation ownership");
  cleanup(root);
}

// G1-C5: production cannot be reclassified as repository infrastructure.
{
  const root = project();
  addFeature(root, "010-compliance-feature-policy-foundation");
  addOwnership(root, [ownershipRule("compliance", "PREFIX", "packages/compliance/", "FEATURE", ["010-compliance-feature-policy-foundation"])]);
  const base = commit(root, "base");
  write(root, "packages/compliance/src/new.ts", "export const x = 1;\n");
  write(root, ".specify/change-bindings/infra.json", JSON.stringify({
    schemaVersion: 2, changeId: "infra-attack", classification: "REPOSITORY_INFRASTRUCTURE",
    exemptionClass: "BUILD_TOOLING", paths: ["packages/compliance/src/new.ts"],
  }, null, 2) + "\n");
  commit(root, "infra attack");
  record("G1-C5 production-as-infrastructure attack fails", 1, run(root, base), "Product implementation changes require classification FEATURE_IMPLEMENTATION");
  cleanup(root);
}

// G2 fixtures.
function setupG2() {
  const root = project();
  addFeature(root, "001-feature-a", "# Feature A\n## FR-001 Contract\nold requirement\n## Other\nold other\n");
  addFeature(root, "002-feature-b", "# Feature B\n## FR-900 Contract\nunrelated\n");
  write(root, "tests/a.test.ts", "export const proof = 1;\n");
  addAuthorityBase(root, authorityUnits());
  return root;
}

// G2-F0: Authority Doc change without an impact declaration fails closed.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  commit(root, "missing impact declaration");
  record(
    "G2-F0 Authority Doc change without impact declaration fails",
    1,
    run(root, base),
    "exactly one changed .specify/authority-impacts/*.json declaration is required; found 0"
  );
  cleanup(root);
}

// G2-F0B: text outside all registered Authority selectors cannot bypass impact convergence.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(
    root,
    "Docs/V1产品需求.md",
    "NEW NORMATIVE PREAMBLE REQUIREMENT\n# V1\n## Normative A\nold normative\n## Metadata\nold reference\n"
  );
  refreshSnapshot(root);
  impactManifest(root, base, []);
  commit(root, "uncovered authority preamble attack");
  record(
    "G2-F0B Authority text outside registered selector coverage fails closed",
    1,
    run(root, base),
    "Authority document changed outside registered Authority Unit selector coverage"
  );
  cleanup(root);
}

// G2-F1: substantive Authority unit cannot claim NO_DOWNSTREAM_IMPACT.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-A",
    classification: "NO_DOWNSTREAM_IMPACT",
    downstream: [],
    exemption: { kind: "NON_NORMATIVE_METADATA" },
  }]);
  commit(root, "fake no impact");
  record("G2-F1 substantive Authority unit plus NO_DOWNSTREAM_IMPACT fails", 1, run(root, base), "Substantive Authority Unit AUTH-A cannot use NO_DOWNSTREAM_IMPACT");
  cleanup(root);
}

// G2-F2: unrelated spec + token delta cannot satisfy Authority unit binding.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  write(root, "specs/002-feature-b/spec.md", "# Feature B\n## FR-900 Contract\nunrelated token delta\n");
  write(root, "tests/a.test.ts", "export const proof = 2;\n");
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-A",
    classification: "AFFECTS_EXISTING_FEATURES",
    downstream: [{
      feature: "002-feature-b",
      specPath: "specs/002-feature-b",
      requirementId: "FR-900",
      requiredArtifacts: ["tests/a.test.ts"],
    }],
  }]);
  commit(root, "fake downstream");
  record("G2-F2 unrelated spec plus token delta fails", 1, run(root, base), "wrong authority→spec binding");
  cleanup(root);
}

// G2-F3: linked spec changed elsewhere but linked requirement did not change.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  write(root, "specs/001-feature-a/spec.md", "# Feature A\n## FR-001 Contract\nold requirement\n## Other\nchanged token only\n");
  write(root, "tests/a.test.ts", "export const proof = 2;\n");
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-A",
    classification: "AFFECTS_EXISTING_FEATURES",
    downstream: [{
      feature: "001-feature-a",
      specPath: "specs/001-feature-a",
      requirementId: "FR-001",
      requiredArtifacts: ["tests/a.test.ts"],
    }],
  }]);
  commit(root, "wrong requirement delta");
  record("G2-F3 valid spec with no corresponding downstream requirement delta fails", 1, run(root, base), "linked downstream requirement did not change");
  cleanup(root);
}

// G2-F3B: CREATES_FUTURE_REQUIREMENT cannot disable the downstream requirement delta check.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  write(root, "specs/001-feature-a/spec.md", "# Feature A\n## FR-001 Contract\nold requirement\n## Other\nchanged token only\n");
  write(root, "tests/a.test.ts", "export const proof = 2;\n");
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-A",
    classification: "CREATES_FUTURE_REQUIREMENT",
    downstream: [{
      feature: "001-feature-a",
      specPath: "specs/001-feature-a",
      requirementId: "FR-001",
      requiredArtifacts: ["tests/a.test.ts"],
    }],
  }]);
  commit(root, "future classification bypass");
  record(
    "G2-F3B future classification cannot bypass requirement delta",
    1,
    run(root, base),
    "future requirement did not change or become newly introduced"
  );
  cleanup(root);
}

// G2-F4: registered Authority unit -> registered requirement -> registered artifact converges.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  write(root, "specs/001-feature-a/spec.md", "# Feature A\n## FR-001 Contract\nnew requirement\n## Other\nold other\n");
  write(root, "tests/a.test.ts", "export const proof = 2;\n");
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-A",
    classification: "AFFECTS_EXISTING_FEATURES",
    downstream: [{
      feature: "001-feature-a",
      specPath: "specs/001-feature-a",
      requirementId: "FR-001",
      requiredArtifacts: ["tests/a.test.ts"],
    }],
  }]);
  commit(root, "valid convergence");
  record("G2-F4 valid linked downstream requirement/artifact passes", 0, run(root, base), "Change governance PASS");
  cleanup(root);
}

// G2-F5: true non-normative metadata section passes only because registry proves boundary.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nold normative\n## Metadata\nnew reference only\n");
  refreshSnapshot(root);
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-METADATA",
    classification: "NO_DOWNSTREAM_IMPACT",
    downstream: [],
    exemption: { kind: "NON_NORMATIVE_METADATA" },
  }]);
  commit(root, "metadata only");
  record("G2-F5 mechanically bounded non-normative metadata-only change passes", 0, run(root, base), "Change governance PASS");
  cleanup(root);
}

// G2-F6: refreshed blob + fake unit impact cannot pass.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-METADATA",
    classification: "NO_DOWNSTREAM_IMPACT",
    downstream: [],
    exemption: { kind: "NON_NORMATIVE_METADATA" },
  }]);
  commit(root, "fake unit contract");
  record("G2-F6 refreshed authority blob plus fake impact contract fails", 1, run(root, base), "Changed Authority Unit impact set");
  cleanup(root);
}

// G2-R6: registry change cannot self-authorize the Authority change that consumes it.
{
  const root = setupG2();
  const base = commit(root, "base");
  const registryPath = ".specify/authority-unit-registry.json";
  const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), "utf8"));
  registry.policy = "changed in consuming change";
  write(root, registryPath, JSON.stringify(registry, null, 2) + "\n");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-A",
    classification: "AFFECTS_EXISTING_FEATURES",
    downstream: [{
      feature: "001-feature-a",
      specPath: "specs/001-feature-a",
      requirementId: "FR-001",
      requiredArtifacts: ["tests/a.test.ts"],
    }],
  }]);
  commit(root, "registry self authorization attack");
  record("G2-R6 registry plus same-change Authority consumption fails", 1, run(root, base), "cannot self-authorize");
  cleanup(root);
}

// G2-R7: future/unimplemented authority has an explicit fail-closed reason.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\nchanged root authority\n## Normative A\nold normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  impactManifest(root, base, [{
    authorityUnitId: "AUTH-V1-ROOT",
    classification: "CREATES_FUTURE_REQUIREMENT",
    downstream: [],
  }]);
  commit(root, "future authority change");
  record("G2-R7 future/unimplemented Authority fails closed explicitly", 1, run(root, base), "FUTURE_UNIMPLEMENTED Authority Unit AUTH-V1-ROOT");
  cleanup(root);
}

// G5 local: fake completion without evidence fails.
{
  const root = project();
  addTaskProvenanceRegistry(root);
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n");
  const base = commit(root, "task base");
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n");
  commit(root, "fake completion");
  record("G5-A fake task completion without evidence fails", 1, run(root, base), "completed tasks require");
  cleanup(root);
}

// G5-R0: an established legacy baseline cannot be edited in the consuming change.
{
  const root = project();
  addTaskProvenanceRegistry(root);
  const pending = "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n";
  const completed = "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n";
  write(root, "specs/001-fixture/tasks.md", pending);
  write(root, ".specify/legacy-task-completion-baseline.json", JSON.stringify({
    schemaVersion: 1,
    files: [],
  }, null, 2) + "\n");
  const base = commit(root, "task base with trusted baseline");
  write(root, "specs/001-fixture/tasks.md", completed);
  write(root, ".specify/legacy-task-completion-baseline.json", JSON.stringify({
    schemaVersion: 1,
    files: [{ path: "specs/001-fixture/tasks.md", blobSha: blobSha(completed) }],
  }, null, 2) + "\n");
  commit(root, "same-change baseline authorization attack");
  record(
    "G5-R0 established legacy baseline is immutable",
    1,
    run(root, base),
    "Legacy task completion baseline is immutable once established"
  );
  cleanup(root);
}

// G5-R0B: initial baseline bootstrap may only record exact task blobs already present at trusted base.
{
  const root = project();
  addTaskProvenanceRegistry(root);
  const pending = "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n";
  const completed = "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n";
  write(root, "specs/001-fixture/tasks.md", pending);
  const base = commit(root, "task base without baseline");
  write(root, "specs/001-fixture/tasks.md", completed);
  write(root, ".specify/legacy-task-completion-baseline.json", JSON.stringify({
    schemaVersion: 1,
    files: [{ path: "specs/001-fixture/tasks.md", blobSha: blobSha(completed) }],
  }, null, 2) + "\n");
  commit(root, "forged baseline bootstrap");
  record(
    "G5-R0B baseline bootstrap cannot grandfather same-change completion",
    1,
    run(root, base),
    "bootstrap entry must match the exact trusted-base task blob"
  );
  cleanup(root);
}

// G5 local: task feature identity is mechanically bound.
{
  const root = project();
  addTaskProvenanceRegistry(root);
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n");
  write(root, "tests/proof.test.ts", "export const proof = true;\n");
  const base = commit(root, "base");
  const verify = "tests/proof.test.ts";
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:" + verify + "]\n");
  write(root, ".specify/task-evidence/001-fixture.json", JSON.stringify({
    schemaVersion: 3,
    featureId: "999-wrong",
    provenanceKind: "FEATURE_IMPLEMENTATION",
    taskFile: "specs/001-fixture/tasks.md",
    implementationPr: 1,
    implementationHeadSha: base,
    mergeCommitSha: base,
    taskIds: ["T001"],
    taskVerifications: [{
      taskId: "T001",
      reqContract: "U01",
      verifyContract: verify,
      verificationPaths: ["tests/proof.test.ts"],
    }],
    artifactPaths: ["tests/proof.test.ts"],
    verificationPaths: ["tests/proof.test.ts"],
    ciRuns: [{ name: "CI", runId: 1, conclusion: "success", headSha: base }],
  }, null, 2) + "\n");
  commit(root, "wrong feature");
  record("G5-B task feature identity mismatch fails", 1, run(root, base), "task feature identity mismatch");
  cleanup(root);
}

// G5 local valid evidence contract passes.
{
  const root = project();
  addTaskProvenanceRegistry(root);
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n");
  write(root, "tests/proof.test.ts", "export const proof = true;\n");
  const base = commit(root, "base");
  const verify = "tests/proof.test.ts";
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:" + verify + "]\n");
  write(root, ".specify/task-evidence/001-fixture.json", JSON.stringify({
    schemaVersion: 3,
    featureId: "001-fixture",
    provenanceKind: "FEATURE_IMPLEMENTATION",
    taskFile: "specs/001-fixture/tasks.md",
    implementationPr: 1,
    implementationHeadSha: base,
    mergeCommitSha: base,
    taskIds: ["T001"],
    taskVerifications: [{
      taskId: "T001",
      reqContract: "U01",
      verifyContract: verify,
      verificationPaths: ["tests/proof.test.ts"],
    }],
    artifactPaths: ["tests/proof.test.ts"],
    verificationPaths: ["tests/proof.test.ts"],
    ciRuns: [{ name: "CI", runId: 1, conclusion: "success", headSha: base }],
  }, null, 2) + "\n");
  commit(root, "valid evidence");
  record("G5-C task REQ/VERIFY mapping and concrete verification artifact pass locally", 0, run(root, base), "Change governance PASS");
  cleanup(root);
}

// G5-R5: task provenance registry cannot self-authorize SHARED_REMEDIATION evidence.
{
  const root = project();
  addTaskProvenanceRegistry(root);
  write(root, "specs/001-fixture/spec.md", "# spec\n");
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [ ] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n");
  write(root, "tests/proof.test.ts", "export const proof = true;\n");
  const base = commit(root, "base");
  addTaskProvenanceRegistry(root, [{
    id: "shared-1",
    sourceFeature: "999-source",
    targetFeatures: ["001-fixture"],
    implementationPr: 1,
  }]);
  write(root, "specs/001-fixture/tasks.md", "# Tasks\n\n- [x] T001 implement [REQ:U01] [VERIFY:tests/proof.test.ts]\n");
  write(root, ".specify/task-evidence/001-fixture.json", JSON.stringify({
    schemaVersion: 3,
    featureId: "001-fixture",
    provenanceKind: "SHARED_REMEDIATION",
    sharedRemediationBindingId: "shared-1",
    sharedSourceFeature: "999-source",
    taskFile: "specs/001-fixture/tasks.md",
    implementationPr: 1,
    implementationHeadSha: base,
    mergeCommitSha: base,
    taskIds: ["T001"],
    taskVerifications: [{
      taskId: "T001",
      reqContract: "U01",
      verifyContract: "tests/proof.test.ts",
      verificationPaths: ["tests/proof.test.ts"],
    }],
    artifactPaths: ["tests/proof.test.ts"],
    verificationPaths: ["tests/proof.test.ts"],
    ciRuns: [{ name: "CI", runId: 1, conclusion: "success", headSha: base }],
  }, null, 2) + "\n");
  commit(root, "shared remediation self authorization");
  record("G5-R5 shared-remediation registry plus consuming evidence fails", 1, run(root, base), "cannot self-authorize SHARED_REMEDIATION");
  cleanup(root);
}

// G8 regression: historical label cannot replace missing Authority impact contract.
{
  const root = setupG2();
  const base = commit(root, "base");
  write(root, "Docs/V1产品需求.md", "# V1\n## Normative A\nnew normative\n## Metadata\nold reference\n");
  refreshSnapshot(root);
  commit(root, "label cannot authorize");
  record("G8 approved-docs-change label cannot manufacture Authority change evidence", 1, run(root, base, { PR_LABELS: "approved-docs-change" }), "exactly one changed .specify/authority-impacts");
  cleanup(root);
}

let failed = 0;
for (const item of results) {
  if (!item.pass) failed += 1;
  console.log((item.pass ? "PASS" : "FAIL") + "  " + item.name + " — expected exit " + item.expected + ", got " + item.actual);
  if (!item.pass) {
    if (item.marker) console.log("      expected output to contain: " + item.marker);
    console.log(item.out.trim().split("\n").map((line) => "      " + line).join("\n"));
  }
}
if (failed > 0) {
  console.error("\nChange governance adversarial self-test FAILED: " + failed + "/" + results.length);
  process.exit(1);
}
console.log("\nChange governance adversarial self-test PASS: " + results.length + "/" + results.length);
