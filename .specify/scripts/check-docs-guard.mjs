#!/usr/bin/env node
/**
 * Docs immutability gate.
 *
 * The four approved product/technical documents and the reference material under
 * `Docs/**` are the authority Spec Kit artifacts project from. They must not drift
 * as a side effect of feature, fix, or chore work.
 *
 * Default behaviour: a change to any `Docs/**` path fails this gate.
 * Explicit, auditable exception: the pull request carries the
 * `approved-docs-change` label, which a human applies after reviewing the
 * document change itself. The label admits the change to normal review; it is
 * never an automatic approval and it does not skip any other governance check.
 *
 * No document SHA is pinned here. The gate protects "unapproved drift", not
 * "permanent immutability".
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const DEFAULT_LABEL = "approved-docs-change";
const DOCS_PREFIX = "Docs/";

function parseArgs(argv) {
  const opts = {
    base: "origin/main",
    head: "HEAD",
    changedFiles: null,
    labels: process.env.PR_LABELS ?? "",
    mode: "enforce",
    labelName: DEFAULT_LABEL,
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
    else if (arg === "--labels") opts.labels = next();
    else if (arg === "--mode") opts.mode = next();
    else if (arg === "--label-name") opts.labelName = next();
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: check-docs-guard.mjs [--base <ref>] [--head <ref>] [--changed-files <file>]\n" +
          "                            [--labels <csv>] [--mode enforce|audit] [--label-name <name>]"
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

function parseLabels(raw) {
  return new Set(
    String(raw)
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
  );
}

const opts = parseArgs(process.argv.slice(2));
const changed = opts.changedFiles ? changedFilesFromFile(opts.changedFiles) : changedFilesFromGit(opts.base, opts.head);
const docsChanged = changed.filter(isDocsPath).sort();
const labels = parseLabels(opts.labels);
const approved = labels.has(opts.labelName);

console.log("Docs immutability gate");
console.log(`  revision range: ${opts.changedFiles ? `file:${opts.changedFiles}` : `${opts.base}...${opts.head}`}`);
console.log(`  changed files: ${changed.length}`);
console.log(`  Docs changed: ${docsChanged.length > 0 ? "YES" : "NO"}`);

if (docsChanged.length === 0) {
  console.log(`  override label "${opts.labelName}": NOT REQUIRED`);
  console.log("PASS: no Docs/** path was modified.");
  process.exit(0);
}

console.log(`  Docs files (${docsChanged.length}):`);
for (const filePath of docsChanged) console.log(`    - ${filePath}`);
console.log(`  override label "${opts.labelName}": ${approved ? "PRESENT" : "ABSENT"}`);

if (approved) {
  console.log("PASS (override): Docs changes are admitted to normal review.");
  console.log(
    `  Audit note: "${opts.labelName}" was applied on the pull request. This is not an approval ` +
      "of the content and does not bypass any other governance check."
  );
  process.exit(0);
}

const reason =
  `FAIL: ${docsChanged.length} file(s) under Docs/** changed without the "${opts.labelName}" label.\n` +
  "  Docs/** holds the approved product and technical sources. Change them deliberately:\n" +
  `  1. review the document diff itself; 2. apply the "${opts.labelName}" label if the change is intended;\n` +
  "  3. keep feature work in specs/, never as a side effect of Docs edits.";

if (opts.mode === "audit") {
  console.log(`AUDIT ONLY (mode=audit): this run would fail in enforce mode.\n${reason}`);
  process.exit(0);
}

console.error(reason);
process.exit(1);
