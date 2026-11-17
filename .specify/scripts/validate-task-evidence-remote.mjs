#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  console.error("Remote task evidence validation requires GITHUB_REPOSITORY=owner/repo.");
  process.exit(1);
}
if (!token) {
  console.error("Remote task evidence validation requires GITHUB_TOKEN.");
  process.exit(1);
}

async function github(pathname) {
  const response = await fetch(`https://api.github.com/repos/${repository}${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "xiaoshuyin-governance-evidence-validator",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${pathname}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

const dir = path.join(root, ".specify", "task-evidence");
if (!fs.existsSync(dir)) {
  console.error("Missing .specify/task-evidence directory.");
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
if (files.length === 0) {
  console.error("No task evidence manifests found.");
  process.exit(1);
}

const errors = [];
for (const name of files) {
  const rel = `.specify/task-evidence/${name}`;
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  } catch (error) {
    errors.push(`${rel}: unreadable JSON (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }

  try {
    const pr = await github(`/pulls/${evidence.implementationPr}`);
    if (!pr.merged_at) errors.push(`${rel}: implementation PR #${evidence.implementationPr} is not merged.`);
    if (pr.head?.sha !== evidence.implementationHeadSha) {
      errors.push(`${rel}: PR head mismatch; GitHub=${pr.head?.sha} manifest=${evidence.implementationHeadSha}`);
    }
    if (pr.merge_commit_sha !== evidence.mergeCommitSha) {
      errors.push(`${rel}: PR merge commit mismatch; GitHub=${pr.merge_commit_sha} manifest=${evidence.mergeCommitSha}`);
    }
    if (evidence.mergedAt && pr.merged_at !== evidence.mergedAt) {
      errors.push(`${rel}: mergedAt mismatch; GitHub=${pr.merged_at} manifest=${evidence.mergedAt}`);
    }
  } catch (error) {
    errors.push(`${rel}: cannot verify implementation PR — ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const run of evidence.ciRuns ?? []) {
    try {
      const remote = await github(`/actions/runs/${run.runId}`);
      if (remote.name !== run.name) {
        errors.push(`${rel}: run ${run.runId} name mismatch; GitHub=${remote.name} manifest=${run.name}`);
      }
      if (remote.head_sha !== evidence.implementationHeadSha || remote.head_sha !== run.headSha) {
        errors.push(`${rel}: run ${run.runId} head SHA mismatch.`);
      }
      if (remote.event !== "pull_request") {
        errors.push(`${rel}: run ${run.runId} must be exact-head pull_request evidence, got event=${remote.event}`);
      }
      if (remote.status !== "completed" || remote.conclusion !== "success" || run.conclusion !== "success") {
        errors.push(`${rel}: run ${run.runId} is not completed/success.`);
      }
    } catch (error) {
      errors.push(`${rel}: cannot verify Actions run ${run?.runId} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Remote task evidence validation FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Remote task evidence validation PASS: ${files.length} manifest(s), GitHub PR/run provenance verified.`);
