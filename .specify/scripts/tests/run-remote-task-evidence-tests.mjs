#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const validator = path.resolve(here, "..", "validate-task-evidence-remote.mjs");

if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
  console.error("Remote task evidence adversarial tests require GITHUB_TOKEN and GITHUB_REPOSITORY.");
  process.exit(1);
}

const canonical = JSON.parse(
  fs.readFileSync(path.join(root, ".specify", "task-evidence", "010-compliance-feature-policy-foundation.json"), "utf8")
);
const canonicalTasks = fs.readFileSync(path.join(root, canonical.taskFile), "utf8");

function verificationPatterns(verify) {
  return [...new Set((verify?.match(/(?:tests|scripts|\.github\/workflows|\.specify\/scripts)\/[A-Za-z0-9_.*?\/-]+/g)) || [])];
}
function globMatches(pattern, value) {
  let source = "";
  for (const ch of pattern) {
    if (ch === "*") source += ".*";
    else if (ch === "?") source += ".";
    else source += /[\\^$.*+?()[\]{}|]/.test(ch) ? "\\" + ch : ch;
  }
  return new RegExp("^" + source + "$").test(value);
}
function runCase(manifests, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-remote-evidence-"));
  const evidenceDir = path.join(dir, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (const [name, value] of Object.entries(manifests)) {
    fs.writeFileSync(path.join(evidenceDir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
  }
  const env = { ...process.env, TASK_EVIDENCE_DIR: evidenceDir };
  if (options.registry) {
    const registryPath = path.join(dir, "registry.json");
    fs.writeFileSync(registryPath, JSON.stringify(options.registry, null, 2) + "\n", "utf8");
    env.TASK_PROVENANCE_REGISTRY_PATH = registryPath;
  }
  if (options.taskFiles) {
    const taskRoot = path.join(dir, "tasks");
    for (const [rel, value] of Object.entries(options.taskFiles)) {
      const file = path.join(taskRoot, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, value, "utf8");
    }
    env.TASK_SOURCE_ROOT = taskRoot;
  }
  const result = spawnSync(process.execPath, [validator], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: result.status, out: (result.stdout ?? "") + (result.stderr ?? "") };
}
function findWrongPath(mapping) {
  const patterns = verificationPatterns(mapping.verifyContract);
  return canonical.verificationPaths.find((candidate) =>
    !mapping.verificationPaths.includes(candidate) &&
    !patterns.some((pattern) => globMatches(pattern, candidate))
  );
}

const cases = [];

// G5-R1: correct feature/PR and a real test, but unrelated to the selected task VERIFY.
{
  const mapping = canonical.taskVerifications.find((item) => findWrongPath(item));
  const wrong = findWrongPath(mapping);
  const attack = structuredClone(canonical);
  attack.taskVerifications.find((item) => item.taskId === mapping.taskId).verificationPaths = [wrong];
  attack.verificationPaths = [...new Set(attack.taskVerifications.flatMap((item) => item.verificationPaths))];
  attack.artifactPaths = [...new Set([...attack.artifactPaths, wrong])];
  cases.push({
    name: "G5-R1 same-feature unrelated real test is rejected",
    expected: 1,
    marker: "verification path is not authorized by task VERIFY contract",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

// G5-R2: task A points to task B's verification artifact.
{
  let pair = null;
  for (const a of canonical.taskVerifications) {
    for (const b of canonical.taskVerifications) {
      if (a.taskId === b.taskId) continue;
      const candidate = b.verificationPaths[0];
      if (!verificationPatterns(a.verifyContract).some((pattern) => globMatches(pattern, candidate))) {
        pair = { a, b, candidate };
        break;
      }
    }
    if (pair) break;
  }
  const attack = structuredClone(canonical);
  attack.taskVerifications.find((item) => item.taskId === pair.a.taskId).verificationPaths = [pair.candidate];
  attack.verificationPaths = [...new Set(attack.taskVerifications.flatMap((item) => item.verificationPaths))];
  attack.artifactPaths = [...new Set([...attack.artifactPaths, pair.candidate])];
  cases.push({
    name: "G5-R2 task A to task B verification is rejected",
    expected: 1,
    marker: "verification path is not authorized by task VERIFY contract",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

// G5-R3: one completed task has no task-specific mapping.
{
  const attack = structuredClone(canonical);
  attack.taskVerifications = attack.taskVerifications.slice(1);
  cases.push({
    name: "G5-R3 completed task without mapping is rejected",
    expected: 1,
    marker: "completed task with no task-specific verification mapping",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

// G5-R4: path matches task VERIFY contract but is absent from implementation PR delta.
{
  const mapping = canonical.taskVerifications.find((item) => item.verifyContract.includes("tests/db/*compliance*"));
  const fake = "tests/db/not-in-pr-compliance-proof.test.ts";
  const attack = structuredClone(canonical);
  attack.taskVerifications.find((item) => item.taskId === mapping.taskId).verificationPaths = [fake];
  attack.verificationPaths = [...new Set(attack.taskVerifications.flatMap((item) => item.verificationPaths))];
  attack.artifactPaths = [...new Set([...attack.artifactPaths, fake])];
  cases.push({
    name: "G5-R4 verification outside implementation PR delta is rejected",
    expected: 1,
    marker: "artifact not present in implementation PR delta: " + fake,
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

// G5-R6: SHARED_REMEDIATION cannot name a nonexistent repository binding.
{
  const attack = structuredClone(canonical);
  attack.provenanceKind = "SHARED_REMEDIATION";
  attack.sharedRemediationBindingId = "does-not-exist";
  cases.push({
    name: "G5-R6 fake shared remediation binding is rejected",
    expected: 1,
    marker: "fake/nonexistent shared remediation binding",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

// G5-R7: provenanceKind=SHARED_REMEDIATION cannot turn one real PR into universal evidence.
{
  const targetFeature = "999-shared-target";
  const proof = canonical.verificationPaths[0];
  const target = {
    ...structuredClone(canonical),
    featureId: targetFeature,
    provenanceKind: "SHARED_REMEDIATION",
    sharedRemediationBindingId: "shared-wrong-source",
    sharedSourceFeature: "999-wrong-source",
    taskFile: "specs/" + targetFeature + "/tasks.md",
    taskIds: ["T001"],
    taskVerifications: [{
      taskId: "T001",
      reqContract: "U01",
      verifyContract: proof,
      verificationPaths: [proof],
    }],
    artifactPaths: [proof],
    verificationPaths: [proof],
    historicalCompletionStatus: "MACHINE_VERIFIED",
    historicalCompletionGaps: [],
  };
  const registry = {
    schemaVersion: 2,
    sharedRemediations: [{
      id: "shared-wrong-source",
      sourceFeature: "999-wrong-source",
      targetFeatures: [targetFeature],
      implementationPr: canonical.implementationPr,
    }],
  };
  const taskFiles = {
    [canonical.taskFile]: canonicalTasks,
    ["specs/" + targetFeature + "/tasks.md"]: "# Tasks\n- [x] T001 shared [REQ:U01] [VERIFY:" + proof + "]\n",
  };
  cases.push({
    name: "G5-R7 universal PR reuse through SHARED_REMEDIATION is rejected",
    expected: 1,
    marker: "cannot be reused as universal evidence for " + targetFeature,
    actual: runCase({
      "010-compliance-feature-policy-foundation.json": canonical,
      [targetFeature + ".json"]: target,
    }, { registry, taskFiles }),
  });
}

// G5-R9: malformed provenance cannot masquerade as valid historical evidence.
{
  const attack = structuredClone(canonical);
  attack.provenanceKind = "MALFORMED";
  cases.push({
    name: "G5-R9 malformed provenance kind is rejected",
    expected: 1,
    marker: "provenanceKind must be FEATURE_IMPLEMENTATION or SHARED_REMEDIATION.",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

// G5-R8: fully task-specific provenance remains valid.
{
  cases.push({
    name: "G5-R8 valid task-specific provenance passes",
    expected: 0,
    marker: "task→REQ/VERIFY→artifact→PR-delta→exact-head-CI provenance verified",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": canonical }),
  });
}

let failed = 0;
for (const item of cases) {
  const pass = item.actual.code === item.expected && item.actual.out.includes(item.marker);
  if (!pass) failed += 1;
  console.log((pass ? "PASS" : "FAIL") + "  " + item.name +
    " — expected exit " + item.expected + ", got " + item.actual.code);
  if (!pass) {
    console.log("      expected marker: " + item.marker);
    console.log(item.actual.out.split("\n").map((line) => "      " + line).join("\n"));
  }
}
if (failed > 0) {
  console.error("Remote task evidence adversarial self-test FAILED: " + failed + "/" + cases.length);
  process.exit(1);
}
console.log("Remote task evidence adversarial self-test PASS: " + cases.length + "/" + cases.length);
