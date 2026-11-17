#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const evidenceDir = process.env.TASK_EVIDENCE_DIR
  ? path.resolve(process.env.TASK_EVIDENCE_DIR)
  : path.join(root, ".specify", "task-evidence");
const taskSourceRoot = process.env.TASK_SOURCE_ROOT
  ? path.resolve(process.env.TASK_SOURCE_ROOT)
  : root;
const registryPath = process.env.TASK_PROVENANCE_REGISTRY_PATH
  ? path.resolve(process.env.TASK_PROVENANCE_REGISTRY_PATH)
  : path.join(root, ".specify", "task-provenance-registry.json");

if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  console.error("Remote task evidence validation requires GITHUB_REPOSITORY=owner/repo.");
  process.exit(1);
}
if (!token) {
  console.error("Remote task evidence validation requires GITHUB_TOKEN.");
  process.exit(1);
}

const cache = new Map();
async function github(pathname) {
  if (cache.has(pathname)) return cache.get(pathname);
  const response = await fetch("https://api.github.com/repos/" + repository + pathname, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "xiaoshuyin-governance-evidence-validator",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error("GitHub API " + response.status + " for " + pathname + ": " + body.slice(0, 500));
  }
  const value = await response.json();
  cache.set(pathname, value);
  return value;
}

async function prChangedFiles(prNumber) {
  const files = [];
  for (let page = 1; page <= 30; page += 1) {
    const batch = await github("/pulls/" + prNumber + "/files?per_page=100&page=" + page);
    if (!Array.isArray(batch)) throw new Error("Unexpected PR files response for #" + prNumber);
    for (const item of batch) if (typeof item?.filename === "string") files.push(item.filename);
    if (batch.length < 100) break;
  }
  return new Set(files);
}

function parseCompletedTasks(content) {
  const records = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^- \[([ xX])\] (T\d{3,})\b/);
    if (!match || match[1] === " ") continue;
    const req = line.match(/\[REQ:(.*?)\]/);
    const verify = line.match(/\[VERIFY:(.*)\]\s*$/);
    records.push({
      id: match[2],
      req: req ? req[1].trim() : null,
      verify: verify ? verify[1].trim() : null,
    });
  }
  return records;
}

function exactSet(actualValues, expectedValues) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function verificationPatterns(verify) {
  if (typeof verify !== "string") return [];
  return [...new Set(verify.match(/(?:tests|scripts|\.github\/workflows|\.specify\/scripts)\/[A-Za-z0-9_.\/-*?]+/g) || [])];
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

function isAllowedVerificationPath(rel) {
  return /^(tests\/|scripts\/|\.github\/workflows\/|\.specify\/scripts\/)/.test(rel);
}

const errors = [];
let registry = null;
try {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
} catch (error) {
  console.error("Cannot read task provenance registry: " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
if (registry.schemaVersion !== 2 || !Array.isArray(registry.sharedRemediations)) {
  errors.push("Task provenance registry must have schemaVersion=2 and sharedRemediations[].");
}
const bindingIds = new Set();
for (const [index, binding] of (registry.sharedRemediations ?? []).entries()) {
  const label = "Task provenance sharedRemediations[" + index + "]";
  if (typeof binding?.id !== "string" || !binding.id) errors.push(label + ": id is required.");
  else if (bindingIds.has(binding.id)) errors.push(label + ": duplicate id " + binding.id);
  else bindingIds.add(binding.id);
  if (typeof binding?.sourceFeature !== "string" || !binding.sourceFeature) errors.push(label + ": sourceFeature is required.");
  if (!Array.isArray(binding?.targetFeatures) || binding.targetFeatures.length === 0) errors.push(label + ": targetFeatures[] must be finite and non-empty.");
  if (!Number.isInteger(binding?.implementationPr) || binding.implementationPr <= 0) errors.push(label + ": implementationPr must be a positive integer.");
}

if (!fs.existsSync(evidenceDir)) {
  console.error("Missing task evidence directory: " + evidenceDir);
  process.exit(1);
}
const files = fs.readdirSync(evidenceDir).filter((name) => name.endsWith(".json")).sort();
if (files.length === 0) {
  console.error("No task evidence manifests found.");
  process.exit(1);
}

const uses = [];
for (const name of files) {
  const rel = ".specify/task-evidence/" + name;
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(path.join(evidenceDir, name), "utf8"));
  } catch (error) {
    errors.push(rel + ": unreadable JSON (" + (error instanceof Error ? error.message : String(error)) + ")");
    continue;
  }

  const fileFeature = name.replace(/\.json$/, "");
  if (evidence.schemaVersion !== 3) errors.push(rel + ": schemaVersion must be 3.");
  if (evidence.featureId !== fileFeature) {
    errors.push(rel + ": task feature identity mismatch; featureId " + String(evidence.featureId) + " does not match manifest filename " + fileFeature + ".");
  }
  if (evidence.taskFile !== "specs/" + evidence.featureId + "/tasks.md") {
    errors.push(rel + ": taskFile is not bound to featureId.");
  }

  let taskContent = "";
  try {
    taskContent = fs.readFileSync(path.join(taskSourceRoot, evidence.taskFile), "utf8");
  } catch {
    errors.push(rel + ": cannot read taskFile " + String(evidence.taskFile) + ".");
  }
  const tasks = parseCompletedTasks(taskContent);
  const taskIds = tasks.map((task) => task.id);
  if (!Array.isArray(evidence.taskIds) || !exactSet(evidence.taskIds, taskIds)) {
    errors.push(rel + ": taskIds do not exactly match completed tasks.");
  }
  if (!Array.isArray(evidence.taskVerifications) ||
      !exactSet((evidence.taskVerifications ?? []).map((item) => item?.taskId), taskIds)) {
    errors.push(rel + ": completed task with no task-specific verification mapping.");
  }

  const mappingByTask = new Map((evidence.taskVerifications ?? []).map((item) => [item?.taskId, item]));
  const usedVerification = new Set();
  for (const task of tasks) {
    const mapping = mappingByTask.get(task.id);
    if (!mapping) continue;
    if (mapping.reqContract !== task.req) errors.push(rel + ": " + task.id + " REQ contract mismatch.");
    if (mapping.verifyContract !== task.verify) errors.push(rel + ": " + task.id + " VERIFY contract mismatch.");
    if (!Array.isArray(mapping.verificationPaths) || mapping.verificationPaths.length === 0) {
      errors.push(rel + ": completed task " + task.id + " has no task-specific verification artifact.");
      continue;
    }
    const patterns = verificationPatterns(task.verify);
    if (patterns.length === 0) {
      errors.push(rel + ": completed task " + task.id + " VERIFY contract has no machine-verifiable repository path.");
      continue;
    }
    for (const verificationPath of mapping.verificationPaths) {
      if (!isAllowedVerificationPath(verificationPath)) {
        errors.push(rel + ": " + task.id + " verification path is outside allowed roots: " + String(verificationPath));
        continue;
      }
      if (!patterns.some((pattern) => globMatches(pattern, verificationPath))) {
        errors.push(rel + ": " + task.id + " verification path is not authorized by task VERIFY contract: " + verificationPath);
      }
      if (!evidence.verificationPaths?.includes(verificationPath)) {
        errors.push(rel + ": " + task.id + " verification path is missing from evidence.verificationPaths: " + verificationPath);
      }
      if (!evidence.artifactPaths?.includes(verificationPath)) {
        errors.push(rel + ": " + task.id + " verification path is missing from evidence.artifactPaths: " + verificationPath);
      }
      usedVerification.add(verificationPath);
    }
  }
  if (!Array.isArray(evidence.verificationPaths) || !exactSet(evidence.verificationPaths, [...usedVerification])) {
    errors.push(rel + ": verificationPaths contain orphan verification or omit task-owned verification.");
  }

  let sharedBinding = null;
  if (evidence.provenanceKind === "SHARED_REMEDIATION") {
    sharedBinding = (registry.sharedRemediations ?? []).find((item) => item?.id === evidence.sharedRemediationBindingId);
    if (!sharedBinding ||
        sharedBinding.implementationPr !== evidence.implementationPr ||
        !sharedBinding.targetFeatures?.includes(evidence.featureId)) {
      errors.push(rel + ": fake/nonexistent shared remediation binding.");
    }
  } else if (evidence.provenanceKind !== "FEATURE_IMPLEMENTATION") {
    errors.push(rel + ": provenanceKind must be FEATURE_IMPLEMENTATION or SHARED_REMEDIATION.");
  }
  uses.push({
    feature: evidence.featureId,
    kind: evidence.provenanceKind,
    implementationPr: evidence.implementationPr,
    sharedBinding,
  });

  try {
    const pr = await github("/pulls/" + evidence.implementationPr);
    if (!pr.merged_at) errors.push(rel + ": implementation PR #" + evidence.implementationPr + " is not merged.");
    if (pr.head?.sha !== evidence.implementationHeadSha) {
      errors.push(rel + ": PR head mismatch; GitHub=" + pr.head?.sha + " manifest=" + evidence.implementationHeadSha);
    }
    if (pr.merge_commit_sha !== evidence.mergeCommitSha) {
      errors.push(rel + ": PR merge commit mismatch; GitHub=" + pr.merge_commit_sha + " manifest=" + evidence.mergeCommitSha);
    }
    if (evidence.mergedAt && pr.merged_at !== evidence.mergedAt) {
      errors.push(rel + ": mergedAt mismatch; GitHub=" + pr.merged_at + " manifest=" + evidence.mergedAt);
    }

    const delta = await prChangedFiles(evidence.implementationPr);
    if (evidence.provenanceKind === "FEATURE_IMPLEMENTATION") {
      const featureSpec = "specs/" + evidence.featureId + "/spec.md";
      const featureTasks = "specs/" + evidence.featureId + "/tasks.md";
      if (!delta.has(featureSpec) || !delta.has(featureTasks)) {
        errors.push(rel + ": feature identity mismatch; implementation PR #" + evidence.implementationPr +
          " does not contain both " + featureSpec + " and " + featureTasks + ".");
      }
    }
    if (!Array.isArray(evidence.artifactPaths) || evidence.artifactPaths.length === 0) {
      errors.push(rel + ": artifactPaths must be non-empty.");
    } else {
      for (const artifact of evidence.artifactPaths) {
        if (!delta.has(artifact)) errors.push(rel + ": artifact not present in implementation PR delta: " + artifact);
      }
    }
    for (const verificationPath of evidence.verificationPaths ?? []) {
      if (!delta.has(verificationPath)) errors.push(rel + ": verification artifact not present in implementation PR delta: " + verificationPath);
      if (!evidence.artifactPaths?.includes(verificationPath)) errors.push(rel + ": verification artifact is not included in artifactPaths: " + verificationPath);
      if (!isAllowedVerificationPath(verificationPath)) errors.push(rel + ": verification artifact is not an allowed concrete verification path: " + verificationPath);
    }
  } catch (error) {
    errors.push(rel + ": cannot verify implementation PR/delta — " + (error instanceof Error ? error.message : String(error)));
  }

  for (const run of evidence.ciRuns ?? []) {
    try {
      const remote = await github("/actions/runs/" + run.runId);
      if (remote.name !== run.name) errors.push(rel + ": run " + run.runId + " name mismatch; GitHub=" + remote.name + " manifest=" + run.name);
      if (remote.head_sha !== evidence.implementationHeadSha || remote.head_sha !== run.headSha) {
        errors.push(rel + ": run " + run.runId + " head SHA mismatch.");
      }
      if (remote.event !== "pull_request") errors.push(rel + ": run " + run.runId + " must be exact-head pull_request evidence, got event=" + remote.event);
      if (remote.status !== "completed" || remote.conclusion !== "success" || run.conclusion !== "success") {
        errors.push(rel + ": run " + run.runId + " is not completed/success.");
      }
    } catch (error) {
      errors.push(rel + ": cannot verify Actions run " + run?.runId + " — " + (error instanceof Error ? error.message : String(error)));
    }
  }
}

const byPr = new Map();
for (const use of uses) {
  if (!Number.isInteger(use.implementationPr)) continue;
  if (!byPr.has(use.implementationPr)) byPr.set(use.implementationPr, []);
  byPr.get(use.implementationPr).push(use);
}
for (const [pr, prUses] of byPr.entries()) {
  if (prUses.length <= 1) continue;
  const direct = prUses.filter((item) => item.kind === "FEATURE_IMPLEMENTATION");
  if (direct.length !== 1) {
    errors.push("Implementation PR #" + pr + " cannot be reused as universal evidence through SHARED_REMEDIATION; exactly one source FEATURE_IMPLEMENTATION provenance is required.");
    continue;
  }
  for (const use of prUses.filter((item) => item.kind === "SHARED_REMEDIATION")) {
    if (!use.sharedBinding || use.sharedBinding.sourceFeature !== direct[0].feature) {
      errors.push("Implementation PR #" + pr + " cannot be reused as universal evidence for " + use.feature + "; SHARED_REMEDIATION source relationship is invalid.");
    }
  }
}

if (errors.length > 0) {
  console.error("Remote task evidence validation FAILED:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}
console.log("Remote task evidence validation PASS: " + files.length +
  " manifest(s), task→REQ/VERIFY→artifact→PR-delta→exact-head-CI provenance verified.");
