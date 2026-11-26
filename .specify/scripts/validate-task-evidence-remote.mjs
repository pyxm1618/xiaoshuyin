#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";
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

const MAX_CHANGED_FILE_PAGES = 30;
const CHANGED_FILES_PER_PAGE = 100;
function changedFilePath(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/") &&
    !value.includes("\\") && !value.includes("\0") &&
    !value.split("/").some((part) => !part || part === "." || part === "..");
}
async function prChangedFiles(prNumber, expectedChangedFiles) {
  if (!Number.isInteger(expectedChangedFiles) || expectedChangedFiles < 0) {
    throw new Error("PR #" + prNumber + " has invalid changed_files metadata.");
  }
  if (expectedChangedFiles > MAX_CHANGED_FILE_PAGES * CHANGED_FILES_PER_PAGE) {
    throw new Error("PR #" + prNumber + " changed_files exceeds bounded pagination.");
  }
  const files = new Set();
  for (let page = 1; page <= MAX_CHANGED_FILE_PAGES; page += 1) {
    const batch = await github("/pulls/" + prNumber + "/files?per_page=" + CHANGED_FILES_PER_PAGE + "&page=" + page);
    if (!Array.isArray(batch) || batch.length > CHANGED_FILES_PER_PAGE) {
      throw new Error("Unexpected PR files response for #" + prNumber);
    }
    for (const item of batch) {
      if (!item || typeof item !== "object" || Array.isArray(item) || !changedFilePath(item.filename)) {
        throw new Error("Malformed PR file entry for #" + prNumber);
      }
      if (files.has(item.filename)) throw new Error("Duplicate PR filename for #" + prNumber + ": " + item.filename);
      files.add(item.filename);
      if (files.size > expectedChangedFiles) {
        throw new Error("PR #" + prNumber + " changed-files count exceeds metadata.");
      }
    }
    if (files.size === expectedChangedFiles) break;
    if (batch.length < CHANGED_FILES_PER_PAGE) break;
  }
  if (files.size !== expectedChangedFiles) {
    throw new Error("PR #" + prNumber + " changed-files listing incomplete: " + files.size + " of " + expectedChangedFiles);
  }
  return files;
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
  return [...new Set(verify.match(/(?:tests|scripts|\.github\/workflows|\.specify\/scripts)\/[A-Za-z0-9_.*?\/-]+/g) || [])];
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

// POST_MERGE_CLOSEOUT is deliberately finite: consumers select pre-authorized files.
function closeoutPath(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(value) &&
    !value.split("/").some((part) => part === "." || part === "..");
}
function closeoutSet(values, label, errors) {
  if (!Array.isArray(values) || new Set(values).size !== values.length) {
    errors.push(label + ": expected array without duplicates.");
    return [];
  }
  return values;
}
function validateCloseoutRegistry(registry, errors) {
  if (registry.postMergeCloseouts === undefined) return;
  if (!Array.isArray(registry.postMergeCloseouts)) { errors.push("postMergeCloseouts must be an array."); return; }
  const ids = new Set((registry.sharedRemediations ?? []).map((b) => b.id));
  const features = new Set();
  for (const binding of registry.postMergeCloseouts) {
    if (!/^[a-z0-9-]+$/.test(binding?.id ?? "") || ids.has(binding.id)) errors.push("Invalid/duplicate closeout binding id.");
    ids.add(binding?.id);
    if (!/^[a-z0-9-]+$/.test(binding?.featureId ?? "") || features.has(binding.featureId)) errors.push("Invalid/duplicate closeout featureId.");
    features.add(binding?.featureId);
    const authorizedTaskIds = binding?.authorizedTaskIds;
    if (!Array.isArray(authorizedTaskIds) || !authorizedTaskIds.length || new Set(authorizedTaskIds).size !== authorizedTaskIds.length ||
        authorizedTaskIds.some((id) => typeof id !== "string" || !/^T\d{3,}$/.test(id))) {
      errors.push("Closeout authorizedTaskIds must be a finite/non-empty array of unique task IDs.");
    }
    const sources = Array.isArray(binding?.sources) ? binding.sources : [];
    const sourceIds = new Set();
    const prs = new Set();
    for (const source of sources) {
      if (!/^[a-z0-9-]+$/.test(source?.id ?? "") || sourceIds.has(source.id)) errors.push("Invalid/duplicate closeout source id.");
      sourceIds.add(source?.id);
      if (!["PLANNING", "GOVERNANCE", "IMPLEMENTATION"].includes(source?.role)) errors.push("Invalid closeout source role.");
      if (!Number.isInteger(source?.pr) || source.pr <= 0 || prs.has(source.pr)) errors.push("Invalid/duplicate closeout source PR.");
      prs.add(source?.pr);
      for (const field of ["headSha", "mergeCommitSha"]) if (!/^[0-9a-f]{40}$/.test(source?.[field] ?? "")) errors.push("Invalid closeout source " + field);
      if ((source?.baseBranch ?? "main") !== "main") errors.push("Closeout source baseBranch must be main.");
    }
    for (const role of ["PLANNING", "GOVERNANCE", "IMPLEMENTATION"]) if (sources.filter((s) => s.role === role).length !== 1) errors.push("Closeout requires exactly one " + role + " source.");
    const paths = new Set();
    if (!Array.isArray(binding?.files) || !binding.files.length) errors.push("Closeout files must be finite/non-empty.");
    for (const file of binding?.files ?? []) {
      if (!closeoutPath(file?.path) || paths.has(file.path)) errors.push("Invalid/duplicate closeout file path.");
      paths.add(file?.path);
      if (!sourceIds.has(file?.sourceId)) errors.push("Unknown closeout file source.");
      if (!["DELTA", "TREE"].includes(file?.identity)) errors.push("Invalid closeout file identity.");
      if (typeof file?.verification !== "boolean") errors.push("Closeout file verification flag required.");
      if (file?.verification && !isAllowedVerificationPath(file.path)) errors.push("Invalid closeout verification root.");
      if (file?.identity === "TREE" && (!file.verification || !/^[0-9a-f]{40}$/.test(file.blobSha ?? ""))) errors.push("TREE requires pre-authorized verification path and blob SHA.");
      if (file?.identity === "DELTA" && file.blobSha !== undefined) errors.push("DELTA cannot declare TREE blob.");
    }
  }
}
function validateCloseoutConsumer(evidence, records, binding, rel, errors) {
  const allowedFields = new Set(["schemaVersion", "provenanceKind", "featureId", "taskFile", "closeoutBindingId", "taskIds", "taskVerifications", "ciRuns"]);
  for (const field of Object.keys(evidence)) if (!allowedFields.has(field)) errors.push(rel + ": unknown closeout consumer field: " + field);
  if (evidence.schemaVersion !== 4) errors.push(rel + ": POST_MERGE_CLOSEOUT requires schemaVersion=4.");
  if (!binding) { errors.push(rel + ": missing trusted-base closeout binding."); return; }
  if (evidence.featureId !== binding.featureId) errors.push(rel + ": closeout feature mismatch.");
  for (const forbidden of ["implementationPr", "implementationHeadSha", "mergeCommitSha", "sources", "files"]) {
    if (evidence[forbidden] !== undefined) errors.push(rel + ": consumer cannot supply " + forbidden);
  }
  const taskIds = closeoutSet(evidence.taskIds, rel + " taskIds", errors);
  const mappings = closeoutSet(evidence.taskVerifications, rel + " taskVerifications", errors);
  const actualIds = mappings.map((m) => m?.taskId);
  const checked = records.map((r) => r.id);
  if (new Set(actualIds).size !== actualIds.length || taskIds.length !== checked.length || actualIds.length !== checked.length || checked.some((id) => !taskIds.includes(id) || !actualIds.includes(id))) errors.push(rel + ": checked tasks must exactly match taskIds and taskVerifications.");
  const authorized = closeoutSet(binding.authorizedTaskIds, rel + " authorizedTaskIds", errors);
  if (!authorized.length) errors.push(rel + ": trusted-base closeout binding authorizes no tasks.");
  for (const id of new Set([...taskIds, ...checked])) {
    if (typeof id !== "string" || !authorized.includes(id)) errors.push(rel + ": task is not pre-authorized by trusted-base closeout binding: " + String(id));
  }
  const usedPaths = new Set();
  const usedSources = new Set();
  for (const record of records) {
    const mapping = mappings.find((m) => m?.taskId === record.id);
    if (!record.req || !record.verify || !mapping || mapping.reqContract !== record.req || mapping.verifyContract !== record.verify) { errors.push(rel + ": missing/mismatched REQ/VERIFY mapping " + record.id); continue; }
    const paths = closeoutSet(mapping.verificationPaths, rel + " verificationPaths", errors);
    if (!paths.length) errors.push(rel + ": missing task-specific verification " + record.id);
    const patterns = verificationPatternsCloseout(record.verify);
    for (const verificationPath of paths) {
      const file = binding.files?.find((f) => f.path === verificationPath && f.verification);
      if (!closeoutPath(verificationPath) || !file) errors.push(rel + ": verification path not pre-authorized: " + verificationPath);
      if (!patterns.some((p) => globMatches(p, verificationPath))) errors.push(rel + ": verification path does not match task VERIFY: " + verificationPath);
      usedPaths.add(verificationPath);
      if (file) usedSources.add(file.sourceId);
    }
  }
  const runs = closeoutSet(evidence.ciRuns, rel + " ciRuns", errors);
  const runIds = new Set();
  for (const run of runs) {
    const source = binding.sources?.find((s) => s.id === run?.sourceId);
    if (!source || !usedSources.has(source.id) || !Number.isInteger(run?.runId) || run.runId <= 0 || runIds.has(run.runId) || typeof run.name !== "string" || !run.name || run.headSha !== source.headSha || run.conclusion !== "success") errors.push(rel + ": invalid/orphan/non-exact-source-head CI run.");
    runIds.add(run?.runId);
  }
  for (const sourceId of usedSources) if (!runs.some((r) => r.sourceId === sourceId)) errors.push(rel + ": verification source has no CI run: " + sourceId);
  if (!usedPaths.size) errors.push(rel + ": closeout requires task-specific verification.");
}
function verificationPatternsCloseout(verify) {
  return [...new Set(verify.match(/(?:tests|scripts|\.github\/workflows|\.specify\/scripts)\/[A-Za-z0-9_.*?\/-]+/g) ?? [])];
}
function parseHistoricalTasks(content) {
  const records = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^- \[([ xX])\] (T\d{3,})\b/);
    if (!match) continue;
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
async function closeoutText(source, rel) {
  const item = await closeoutContent(source, rel);
  if (item.encoding !== "base64" || typeof item.content !== "string" || item.truncated) {
    throw new Error("Missing exact-head text content: " + rel);
  }
  return Buffer.from(item.content, "base64").toString("utf8");
}
async function validateHistoricalTaskContract(binding, tasks, rel, errors) {
  const planning = binding.sources?.find((source) => source.role === "PLANNING");
  if (!planning) {
    errors.push(rel + ": missing historical PLANNING source.");
    return;
  }
  const historicalPath = "specs/" + binding.featureId + "/tasks.md";
  let historical;
  try {
    historical = parseHistoricalTasks(await closeoutText(planning, historicalPath));
  } catch (error) {
    errors.push(rel + ": cannot read historical PLANNING task contract: " + (error instanceof Error ? error.message : String(error)));
    return;
  }
  if (!historical.length) {
    errors.push(rel + ": historical PLANNING task contract is empty.");
    return;
  }
  for (const task of tasks) {
    const prior = historical.find((record) => record.id === task.id);
    if (!prior) {
      errors.push(rel + ": historical task missing: " + task.id);
      continue;
    }
    if (!task.req || !task.verify || !prior.req || !prior.verify || task.req !== prior.req || task.verify !== prior.verify) {
      errors.push(rel + ": historical task contract drift: " + task.id);
    }
  }
}

async function closeoutDeltaFeature(pr, rel, feature) {
  for (let page = 1; page <= 30; page += 1) {
    const batch = await github("/pulls/" + pr + "/files?per_page=100&page=" + page);
    if (!Array.isArray(batch)) throw new Error("Invalid feature delta response.");
    const file = batch.find((item) => item.filename === rel);
    if (file) return typeof file.patch === "string" && file.patch.split("\n").some((line) => line.startsWith("+") && !line.startsWith("+++") && line.includes('"' + feature + '"'));
    if (batch.length < 100) return false;
  }
  throw new Error("Feature delta exceeds bounded pagination.");
}

async function closeoutContent(source, rel) {
  const item = await github("/contents/" + rel.split("/").map(encodeURIComponent).join("/") + "?ref=" + source.headSha);
  if (item.type !== "file" || !/^[0-9a-f]{40}$/.test(item.sha ?? "")) throw new Error("Expected exact-head file: " + rel);
  return item;
}
async function closeoutJson(source, rel) {
  const item = await closeoutContent(source, rel);
  if (item.encoding !== "base64" || typeof item.content !== "string") throw new Error("Missing exact-head JSON content: " + rel);
  return JSON.parse(Buffer.from(item.content, "base64").toString("utf8"));
}
// Match the repository's ownership policy against the complete historical registry.
function closeoutOwnership(registry, rel) {
  if (registry.schemaVersion !== 1 || registry.resolution !== "LONGEST_MATCH" || !Array.isArray(registry.rules) || !registry.rules.length) throw new Error("Historical ownership requires schemaVersion=1, LONGEST_MATCH and non-empty rules.");
  const ids = new Set();
  const matchers = new Set();
  const matches = [];
  for (const rule of registry.rules) {
    const kind = rule?.match?.kind;
    const matchPath = rule?.match?.path;
    const features = rule?.ownership?.features;
    if (typeof rule?.id !== "string" || !rule.id || ids.has(rule.id)) throw new Error("Invalid/duplicate historical ownership rule id.");
    ids.add(rule.id);
    if (!["EXACT", "PREFIX"].includes(kind) || (typeof matchPath !== "string" || !closeoutPath(matchPath.endsWith("/") ? matchPath + "_" : matchPath)) || !/^(apps|packages|db)\//.test(matchPath) || (kind === "PREFIX" && !matchPath.endsWith("/") && !matchPath.endsWith("-"))) throw new Error("Invalid historical ownership matcher.");
    const key = kind + ":" + matchPath;
    if (matchers.has(key)) throw new Error("Ambiguous duplicate historical ownership matcher.");
    matchers.add(key);
    if (!["FEATURE", "SHARED"].includes(rule.ownership?.kind) || !Array.isArray(features) || !features.length || new Set(features).size !== features.length || features.some((f) => typeof f !== "string" || !/^[a-zA-Z0-9_-]+$/.test(f)) || (rule.ownership.kind === "FEATURE" && features.length !== 1)) throw new Error("Invalid historical ownership assignment.");
    if ((kind === "EXACT" && rel === matchPath) || (kind === "PREFIX" && rel.startsWith(matchPath))) matches.push(rule);
  }
  matches.sort((a, b) => b.match.path.length - a.match.path.length);
  if (!matches.length) return null;
  if (matches.length > 1 && matches[0].match.path.length === matches[1].match.path.length) throw new Error("Ambiguous historical effective ownership.");
  return matches[0];
}
async function validateCloseoutGraph(binding, errors) {
  const label = "Closeout " + binding.id;
  try {
    const deltas = new Map();
    for (const source of binding.sources) {
      const pr = await github("/pulls/" + source.pr);
      if (pr.number !== source.pr || pr.base?.repo?.full_name !== repository || pr.head?.repo?.full_name !== repository || !pr.merged_at || pr.base?.ref !== (source.baseBranch ?? "main") || pr.head?.sha !== source.headSha || pr.merge_commit_sha !== source.mergeCommitSha) errors.push(label + ": source PR truth mismatch: " + source.id);
      deltas.set(source.id, await prChangedFiles(source.pr, pr.changed_files));
    }
    const planning = binding.sources.find((s) => s.role === "PLANNING");
    for (const name of ["spec.md", "tasks.md"]) if (!deltas.get(planning.id).has("specs/" + binding.featureId + "/" + name)) errors.push(label + ": planning identity missing from delta.");
    const governance = binding.sources.find((s) => s.role === "GOVERNANCE");
    const ownershipPath = ".specify/implementation-ownership.json";
    if (!deltas.get(governance.id).has(ownershipPath)) errors.push(label + ": governance ownership missing from delta.");
    if (!await closeoutDeltaFeature(governance.pr, ownershipPath, binding.featureId)) errors.push(label + ": governance delta does not establish feature ownership.");
    const ownership = await closeoutJson(governance, ownershipPath);

    const implementation = binding.sources.find((s) => s.role === "IMPLEMENTATION");
    const changePath = ".specify/change-bindings/" + binding.featureId + ".json";
    if (!deltas.get(implementation.id).has(changePath)) errors.push(label + ": implementation change-binding missing from delta.");
    if (!await closeoutDeltaFeature(implementation.pr, changePath, binding.featureId)) errors.push(label + ": implementation delta does not establish feature binding.");
    const change = await closeoutJson(implementation, changePath);
    const featureBinding = change.featureBindings?.find((b) => b.feature === binding.featureId && b.specPath === "specs/" + binding.featureId);
    if (!featureBinding?.implementationPaths?.length) errors.push(label + ": implementation has no feature binding.");
    for (const rel of featureBinding?.implementationPaths ?? []) {
      const owner = closeoutOwnership(ownership, rel);
      if (!closeoutPath(rel) || !deltas.get(implementation.id).has(rel) || !owner?.ownership.features.includes(binding.featureId)) errors.push(label + ": implementation ownership/delta mismatch: " + rel);
    }
    for (const file of binding.files) {
      const source = binding.sources.find((s) => s.id === file.sourceId);
      if (!source || !closeoutPath(file.path)) continue;
      if (file.identity === "DELTA") {
        if (!deltas.get(source.id).has(file.path)) errors.push(label + ": DELTA path absent: " + file.path);
      } else if (file.identity === "TREE") {
        const item = await closeoutContent(source, file.path);
        if (item.sha !== file.blobSha) errors.push(label + ": TREE blob mismatch: " + file.path);
      }
    }
  } catch (error) { errors.push(label + ": cannot verify source graph: " + error.message); }
}
async function validateRemoteCloseout(evidence, tasks, registry, rel, errors) {
  let trusted;
  try {
    trusted = JSON.parse(execFileSync("git", ["show", (process.env.GOVERNANCE_BASE || "origin/main") + ":.specify/task-provenance-registry.json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (error) { errors.push(rel + ": cannot read trusted-base registry: " + error.message); return; }
  validateCloseoutRegistry(trusted, errors);
  const binding = trusted.postMergeCloseouts?.find((b) => b.id === evidence.closeoutBindingId);
  const current = registry.postMergeCloseouts?.find((b) => b.id === evidence.closeoutBindingId);
  if (JSON.stringify(binding) !== JSON.stringify(current)) errors.push(rel + ": same-change closeout self authorization forbidden.");
  validateCloseoutConsumer(evidence, tasks, binding, rel, errors);
  if (!binding) return;
  await validateHistoricalTaskContract(binding, tasks, rel, errors);
  for (const run of evidence.ciRuns ?? []) {
    const source = binding.sources?.find((s) => s.id === run?.sourceId);
    if (!source) continue;
    try {
      const remote = await github("/actions/runs/" + run.runId);
      if (remote.name !== run.name || remote.head_sha !== source.headSha || remote.head_sha !== run.headSha || remote.event !== "pull_request" || remote.status !== "completed" || remote.conclusion !== "success" || run.conclusion !== "success") errors.push(rel + ": CI run must be successful/completed pull_request at exact source head.");
    } catch (error) { errors.push(rel + ": cannot verify CI run: " + error.message); }
  }
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
validateCloseoutRegistry(registry, errors);
if (!errors.length) for (const binding of registry.postMergeCloseouts ?? []) await validateCloseoutGraph(binding, errors);
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
  if (evidence.provenanceKind !== "POST_MERGE_CLOSEOUT" && evidence.schemaVersion !== 3) errors.push(rel + ": schemaVersion must be 3.");
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
  if (evidence.provenanceKind === "POST_MERGE_CLOSEOUT") {
    await validateRemoteCloseout(evidence, tasks, registry, rel, errors);
    continue;
  }
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
    if (!sharedBinding) {
      errors.push(rel + ": fake/nonexistent shared remediation binding.");
    } else {
      if (evidence.sharedSourceFeature !== sharedBinding.sourceFeature) {
        errors.push(rel + ": shared remediation source feature mismatch.");
      }
      if (sharedBinding.implementationPr !== evidence.implementationPr ||
          !sharedBinding.targetFeatures?.includes(evidence.featureId)) {
        errors.push(rel + ": shared remediation target/PR relationship is not registered.");
      }
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

    const delta = await prChangedFiles(evidence.implementationPr, pr.changed_files);
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
