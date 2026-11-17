#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const evidenceDir = process.env.TASK_EVIDENCE_DIR
  ? path.resolve(process.env.TASK_EVIDENCE_DIR)
  : path.join(root, ".specify", "task-evidence");

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

if (!fs.existsSync(evidenceDir)) {
  console.error("Missing task evidence directory: " + evidenceDir);
  process.exit(1);
}
const files = fs.readdirSync(evidenceDir).filter((name) => name.endsWith(".json")).sort();
if (files.length === 0) {
  console.error("No task evidence manifests found.");
  process.exit(1);
}

const errors = [];
const seenPrFeature = new Map();

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
  if (evidence.schemaVersion !== 2) errors.push(rel + ": schemaVersion must be 2.");
  if (evidence.featureId !== fileFeature) {
    errors.push(rel + ": task feature identity mismatch; featureId " + String(evidence.featureId) + " does not match manifest filename " + fileFeature + ".");
  }
  if (evidence.taskFile !== "specs/" + evidence.featureId + "/tasks.md") {
    errors.push(rel + ": taskFile is not bound to featureId.");
  }

  const priorFeature = seenPrFeature.get(evidence.implementationPr);
  if (priorFeature && priorFeature !== evidence.featureId && evidence.provenanceKind !== "SHARED_REMEDIATION") {
    errors.push(rel + ": implementation PR #" + evidence.implementationPr + " cannot be reused as universal evidence for features " + priorFeature + " and " + evidence.featureId + ".");
  } else if (!priorFeature) {
    seenPrFeature.set(evidence.implementationPr, evidence.featureId);
  }

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
    const featureSpec = "specs/" + evidence.featureId + "/spec.md";
    const featureTasks = "specs/" + evidence.featureId + "/tasks.md";
    if (evidence.provenanceKind === "FEATURE_IMPLEMENTATION") {
      if (!delta.has(featureSpec) || !delta.has(featureTasks)) {
        errors.push(
          rel + ": feature identity mismatch; implementation PR #" + evidence.implementationPr +
          " does not contain both " + featureSpec + " and " + featureTasks + "."
        );
      }
    }

    if (!Array.isArray(evidence.artifactPaths) || evidence.artifactPaths.length === 0) {
      errors.push(rel + ": artifactPaths must be non-empty.");
    } else {
      for (const artifact of evidence.artifactPaths) {
        if (!delta.has(artifact)) {
          errors.push(rel + ": artifact not present in implementation PR delta: " + artifact);
        }
      }
    }

    if (!Array.isArray(evidence.verificationPaths) || evidence.verificationPaths.length === 0) {
      errors.push(rel + ": verificationPaths must be non-empty.");
    } else {
      for (const verificationPath of evidence.verificationPaths) {
        if (!delta.has(verificationPath)) {
          errors.push(rel + ": verification artifact not present in implementation PR delta: " + verificationPath);
        }
        if (!evidence.artifactPaths?.includes(verificationPath)) {
          errors.push(rel + ": verification artifact is not included in artifactPaths: " + verificationPath);
        }
        if (!/^(tests\/|scripts\/|\.github\/workflows\/|\.specify\/scripts\/tests\/)/.test(verificationPath)) {
          errors.push(rel + ": verification artifact is not an allowed concrete verification path: " + verificationPath);
        }
      }
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

if (errors.length > 0) {
  console.error("Remote task evidence validation FAILED:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}
console.log("Remote task evidence validation PASS: " + files.length + " manifest(s), feature/PR-delta/verification provenance verified.");
