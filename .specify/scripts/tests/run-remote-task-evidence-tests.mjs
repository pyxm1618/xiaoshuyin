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

// Deterministic remote-boundary tests use an explicit fake API, never fallback data.
{
  const sourceText = fs.readFileSync(validator, "utf8");
  const functions = sourceText.slice(sourceText.indexOf("// POST_MERGE_CLOSEOUT"), sourceText.indexOf("const errors = [];"));
  const feature = "fixture-post-merge";
  const check = "scripts/check.mjs";
  const baseBinding = { id: "fixture-closeout", featureId: feature, authorizedTaskIds: ["T001"], sources: ["PLANNING", "GOVERNANCE", "IMPLEMENTATION"].map((role, i) => ({ id: role.toLowerCase(), role, pr: i + 1, headSha: String(i + 1).repeat(40), mergeCommitSha: String(i + 4).repeat(40) })), files: [{ sourceId: "implementation", path: check, identity: "TREE", verification: true, blobSha: "a".repeat(40) }, { sourceId: "implementation", path: "tests/check.test.ts", identity: "DELTA", verification: true }] };
  const baseEvidence = { schemaVersion: 4, provenanceKind: "POST_MERGE_CLOSEOUT", featureId: feature, taskFile: "specs/" + feature + "/tasks.md", closeoutBindingId: baseBinding.id, taskIds: ["T001"], taskVerifications: [{ taskId: "T001", reqContract: "FR-001", verifyContract: check, verificationPaths: [check] }], ciRuns: [{ sourceId: "implementation", runId: 1, name: "CI", headSha: "3".repeat(40), conclusion: "success" }] };
  const variants = [
    ["valid multi-PR DELTA + TREE + CI", null],
    ["unmerged PR", (v) => { v.unmerged = true; }],
    ["wrong head", (v) => { v.wrongHead = true; }],
    ["wrong merge", (v) => { v.wrongMerge = true; }],
    ["wrong repository", (v) => { v.wrongRepo = true; }],
    ["wrong base", (v) => { v.wrongBase = true; }],
    ["DELTA absent", (v) => { v.missingDelta = true; }],
    ["TREE blob mismatch", (v) => { v.wrongBlob = true; }],
    ["missing planning identity", (v) => { v.missingPlanning = true; }],
    ["narrower feature owner overrides foreign broad rule", (v) => { v.effectiveFeature = true; }, 0],
    ["narrower foreign owner overrides broad feature", (v) => { v.foreignExact = true; }],
    ["narrower foreign prefix overrides broad feature", (v) => { v.foreignPrefix = true; }],
    ["ambiguous same-length owners", (v) => { v.ambiguousOwner = true; }],
    ["invalid ownership schema", (v) => { v.invalidOwnershipSchema = true; }],
    ["unsupported ownership resolution", (v) => { v.invalidResolution = true; }],
    ["ownership content mismatch", (v) => { v.noOwnership = true; }],
    ["change binding mismatch", (v) => { v.noChangeBinding = true; }],
    ["missing trusted binding", (v) => { v.trusted.postMergeCloseouts = []; }],
    ["self authorization", (v) => { v.binding.sources[0].pr = 99; }],
    ["TREE not pre-authorized", (v) => { v.evidence.taskVerifications[0].verificationPaths = ["scripts/other.mjs"]; }],
    ["wrong CI head", (v) => { v.run.head_sha = "f".repeat(40); }],
    ["wrong CI event", (v) => { v.run.event = "push"; }],
    ["failed CI", (v) => { v.run.conclusion = "failure"; }],
    ["skipped CI", (v) => { v.run.conclusion = "skipped"; }],
    ["incomplete CI", (v) => { v.run.status = "in_progress"; }],
    ["wildcard authorization", (v) => { v.binding.files[0].path = "scripts/*"; }],
    ["traversal authorization", (v) => { v.binding.files[0].path = "scripts/../secret"; }],
    ["unknown source ref", (v) => { v.binding.files[0].sourceId = "unknown"; }],
    ["duplicate source", (v) => { v.binding.sources.push(v.binding.sources[0]); }],
    ["M01-A unauthorized checked task", (v) => {
      const extra = { sourceId: "implementation", path: "tests/other.test.ts", identity: "DELTA", verification: true };
      v.binding.files.push(extra);
      v.trusted.postMergeCloseouts[0].files.push(structuredClone(extra));
      v.evidence.taskIds.push("T011");
      v.evidence.taskVerifications.push({ taskId: "T011", reqContract: "FR-001", verifyContract: "tests/other.test.ts", verificationPaths: ["tests/other.test.ts"] });
      v.tasks = [{ id: "T001", req: "FR-001", verify: check }, { id: "T011", req: "FR-001", verify: "tests/other.test.ts" }];
      v.historicalExtra = "- [ ] T011 fixture [REQ:FR-001] [VERIFY: tests/other.test.ts]\n";
    }, undefined, "task is not pre-authorized by trusted-base closeout binding"],
    ["M01-C historical REQ drift", (v) => { v.historicalReq = "FR-999"; }, undefined, "historical task contract drift: T001"],
    ["M01-D historical VERIFY drift", (v) => { v.historicalVerify = "scripts/drift.mjs"; }, undefined, "historical task contract drift: T001"],
    ["M01-E current registry cannot expand authorizedTaskIds", (v) => { v.binding.authorizedTaskIds.push("T011"); }, undefined, "same-change closeout self authorization forbidden"],
  ];
  for (const [name, mutate, expected, marker] of variants) {
    const binding = structuredClone(baseBinding);
    const registry = { schemaVersion: 2, sharedRemediations: [], postMergeCloseouts: [binding] };
    const state = { binding, trusted: structuredClone(registry), evidence: structuredClone(baseEvidence), run: { name: "CI", head_sha: "3".repeat(40), event: "pull_request", status: "completed", conclusion: "success" } };
    mutate?.(state);
    const api = async (endpoint) => {
      if (endpoint === "/actions/runs/1") return state.run;
      if (/^\/pulls\/\d+\/files/.test(endpoint)) return [{ filename: ".specify/implementation-ownership.json", patch: '+ "' + feature + '"' }, { filename: ".specify/change-bindings/" + feature + ".json", patch: '+ "' + feature + '"' }];
      const prNumber = Number(endpoint.match(/^\/pulls\/(\d+)$/)?.[1]);
      if (prNumber) {
        const source = binding.sources.find((s) => s.pr === prNumber);
        return { number: prNumber, merged_at: state.unmerged ? null : "2026-01-01", base: { ref: state.wrongBase ? "other" : "main", repo: { full_name: state.wrongRepo ? "other/repo" : "fixture/repo" } }, head: { sha: state.wrongHead ? "f".repeat(40) : source.headSha, repo: { full_name: "fixture/repo" } }, merge_commit_sha: state.wrongMerge ? "f".repeat(40) : source.mergeCommitSha };
      }
      if (endpoint.startsWith("/contents/")) {
        const sha = (state.wrongBlob ? "b" : "a").repeat(40);
        if (endpoint.includes("implementation-ownership.json")) {
          const rule = (id, kind, path, owner) => ({ id, match: { kind, path }, ownership: { kind: "FEATURE", features: [owner] } });
          let value = { schemaVersion: state.invalidOwnershipSchema ? 2 : 1, resolution: state.invalidResolution ? "ANY_MATCH" : "LONGEST_MATCH", rules: state.noOwnership ? [] : [rule("feature", "PREFIX", "apps/", feature)] };
          if (state.effectiveFeature) value.rules = [rule("foreign", "PREFIX", "apps/", "other-feature"), rule("feature", "EXACT", "apps/nested/fixture.ts", feature)];
          if (state.foreignExact) value.rules.push(rule("foreign", "EXACT", "apps/nested/fixture.ts", "other-feature"));
          if (state.foreignPrefix) value.rules.push(rule("foreign", "PREFIX", "apps/nested/", "other-feature"));
          if (state.ambiguousOwner) value.rules.push(rule("foreign", "PREFIX", "apps/", "other-feature"));
          return { type: "file", sha, encoding: "base64", content: Buffer.from(JSON.stringify(value)).toString("base64") };
        }
        if (endpoint.includes("change-bindings/")) {
          const value = { featureBindings: state.noChangeBinding ? [] : [{ feature, specPath: "specs/" + feature, implementationPaths: ["apps/nested/fixture.ts"] }] };
          return { type: "file", sha, encoding: "base64", content: Buffer.from(JSON.stringify(value)).toString("base64") };
        }
        const historical = "- [ ] T001 fixture [REQ:" + (state.historicalReq ?? "FR-001") + "] [VERIFY: " + (state.historicalVerify ?? check) + "]\n" + (state.historicalExtra ?? "");
        return { type: "file", sha, encoding: "base64", content: Buffer.from(historical).toString("base64") };
      }
      throw new Error("Unexpected fixture API request " + endpoint);
    };
    const delta = async (pr) => new Set(pr === 1 ? (state.missingPlanning ? [] : ["specs/" + feature + "/spec.md", "specs/" + feature + "/tasks.md"]) : pr === 2 ? [".specify/implementation-ownership.json"] : [".specify/change-bindings/" + feature + ".json", "apps/nested/fixture.ts", ...(state.missingDelta ? [] : ["tests/check.test.ts"])]);
    const factory = new Function("github", "prChangedFiles", "execFileSync", "repository", "root", "isAllowedVerificationPath", "globMatches", functions + "\nreturn {validateCloseoutRegistry,validateCloseoutGraph,validateRemoteCloseout};");
    const functionsUnderTest = factory(api, delta, () => JSON.stringify(state.trusted), "fixture/repo", root, (p) => /^(tests\/|scripts\/|\.github\/workflows\/|\.specify\/scripts\/)/.test(p), globMatches);
    const errors = [];
    functionsUnderTest.validateCloseoutRegistry(registry, errors);
    if (!errors.length) await functionsUnderTest.validateCloseoutGraph(binding, errors);
    await functionsUnderTest.validateRemoteCloseout(state.evidence, state.tasks ?? [{ id: "T001", req: "FR-001", verify: check }], registry, "fixture", errors);
    cases.push({ name: "PMC remote " + name, expected: expected ?? (mutate ? 1 : 0), marker: marker ?? "", actual: { code: errors.length ? 1 : 0, out: errors.join("\n") } });
  }
}

// PMC-M02 deterministic changed-files completeness tests against the real helper.
{
  const sourceText = fs.readFileSync(validator, "utf8");
  const helperSource = sourceText.slice(sourceText.indexOf("const MAX_CHANGED_FILE_PAGES"), sourceText.indexOf("function parseCompletedTasks"));
  const makeChangedFiles = new Function("github", helperSource + "\nreturn prChangedFiles;");
  const page = (prefix, count) => Array.from({ length: count }, (_, index) => ({ filename: prefix + String(index).padStart(4, "0") + ".ts" }));
  const scenarios = [
    ["M02-A normal pagination", 4, [page("a", 4)], 0, ""],
    ["M02-B metadata count mismatch", 4, [page("a", 3)], 1, "changed-files listing incomplete"],
    ["M02-C early incomplete pagination", 150, [page("a", 100), page("b", 40)], 1, "changed-files listing incomplete"],
    ["M02-D metadata above 3000 bound", 3001, [], 1, "exceeds bounded pagination"],
    ["M02-D 30 full pages cannot prove completeness", 2999, Array.from({ length: 30 }, (_, i) => page("p" + i + "-", 100)), 1, "exceeds metadata"],
    ["M02-E malformed filename entry", 2, [[{ filename: "a.ts" }, {}]], 1, "Malformed PR file entry"],
    ["M02-F duplicate filename", 2, [[{ filename: "a.ts" }, { filename: "a.ts" }]], 1, "Duplicate PR filename"],
    ["M02-G GitHub API failure", 1, [], 1, "GitHub API failure"],
  ];
  for (const [name, metadata, pages, expected, marker] of scenarios) {
    const github = async (endpoint) => {
      if (name.includes("GitHub API failure")) throw new Error("GitHub API failure");
      const index = Number(endpoint.match(/&page=(\d+)/)?.[1]) - 1;
      if (!Number.isInteger(index) || index < 0) throw new Error("Unexpected endpoint " + endpoint);
      return pages[index] ?? [];
    };
    let code = 0;
    let out = "";
    try {
      const files = await makeChangedFiles(github)(1, metadata);
      if (files.size !== metadata) throw new Error("unexpected result size " + files.size);
    } catch (error) {
      code = 1;
      out = error instanceof Error ? error.message : String(error);
    }
    cases.push({ name: "PMC remote " + name, expected, marker, actual: { code, out } });
  }
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
