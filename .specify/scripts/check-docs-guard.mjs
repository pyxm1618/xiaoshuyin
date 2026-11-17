#!/usr/bin/env node
/**
 * Docs immutability gate.
 *
 * The four approved product/technical documents and the reference material under
 * `Docs/**` are the authority Spec Kit artifacts project from. They must not drift
 * as a side effect of feature, fix, or chore work.
 *
 * Any change to a `Docs/**` path fails this legacy immutability probe in
 * enforce mode. Labels are deliberately ignored: an agent or connector can
 * apply labels, so a label is not evidence of independent human approval.
 *
 * Intended Authority revisions are governed by validate-change-governance.mjs:
 * the PR must carry an Authority Impact Contract and downstream convergence,
 * while merge provenance is enforced by GitHub's native required review rules.
 *
 * No document SHA is pinned here. The protected invariant is that Authority
 * changes must travel through the explicit convergence + native review path.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const DOCS_PREFIX = "Docs/";

function parseArgs(argv) {
  const opts = {
    base: "origin/main",
    head: "HEAD",
    changedFiles: null,
    mode: "enforce",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) {
        console.error(`Missing value for ${arg}`);
        process.exit(1);
      }
      i += 1;
      return value;
    };
    if (arg === "--base") opts.base = next();
    else if (arg === "--head") opts.head = next();
    else if (arg === "--changed-files") opts.changedFiles = next();
    else if (arg === "--mode") opts.mode = next();
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: check-docs-guard.mjs [--base <ref>] [--head <ref>] [--changed-files <file>] [--mode enforce|audit]"
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!["enforce", "audit"].includes(opts.mode)) {
    console.error(`Invalid --mode: ${opts.mode} (expected enforce or audit)`);
    process.exit(1);
  }
  return opts;
}

function changedFilesFromGit(base, head) {
  let output;
  try {
    output = execFileSync(
      "git",
      ["-c", "core.quotePath=false", "diff", "--name-only", "-z", "--diff-filter=ACDMRTUXB", `${base}...${head}`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    console.error(`Cannot diff ${base}...${head}: ${detail}`);
    console.error("Fetch the base ref (git fetch --no-tags --prune origin) and retry.");
    process.exit(1);
  }
  return output.split("\0").filter(Boolean);
}

function changedFilesFromFile(file) {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isDocsPath(filePath) {
  return filePath === "Docs" || filePath.startsWith(DOCS_PREFIX);
}

const opts = parseArgs(process.argv.slice(2));
const changed = opts.changedFiles ? changedFilesFromFile(opts.changedFiles) : changedFilesFromGit(opts.base, opts.head);
const docsChanged = changed.filter(isDocsPath).sort();

console.log("Docs immutability gate");
console.log(`  revision range: ${opts.changedFiles ? `file:${opts.changedFiles}` : `${opts.base}...${opts.head}`}`);
console.log(`  changed files: ${changed.length}`);
console.log(`  Docs changed: ${docsChanged.length > 0 ? "YES" : "NO"}`);

if (docsChanged.length === 0) {
  console.log("PASS: no Docs/** path was modified.");
  process.exit(0);
}

console.log(`  Docs files (${docsChanged.length}):`);
for (const filePath of docsChanged) console.log(`    - ${filePath}`);
const reason =
  `FAIL: ${docsChanged.length} file(s) under Docs/** changed. Labels cannot override this probe.\n` +
  "  Intended Authority revisions must use the Authority Impact Contract and downstream convergence gate,\n" +
  "  then obtain the repository's native independent approval after the latest reviewable push.";

if (opts.mode === "audit") {
  console.log(`AUDIT ONLY (mode=audit): this run would fail in enforce mode.\n${reason}`);
  process.exit(0);
}

console.error(reason);
process.exit(1);
