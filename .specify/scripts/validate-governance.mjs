import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const requiredFiles = [
  "Docs/总产品需求.md",
  "Docs/总体技术架构.md",
  "Docs/V1产品需求.md",
  "Docs/V1技术设计.md",
  "AGENTS.md",
  ".specify/memory/constitution.md",
  ".specify/templates/spec-template.md",
  ".specify/templates/plan-template.md",
  ".specify/templates/tasks-template.md",
  ".specify/templates/checklist-template.md",
];

for (const rel of requiredFiles) {
  if (!exists(rel)) errors.push(`Missing required governance/source file: ${rel}`);
}

// Spec Kit delivers a feature artifact set in stages:
//   specify -> spec.md   |   plan -> plan.md   |   tasks -> tasks.md
// A feature directory is therefore allowed to be mid-flight. What is NOT allowed is
// a later artifact existing without its predecessors, or a feature with no spec at all.
// Every artifact that does exist must satisfy the full traceability contract below.
const specsRoot = path.join(root, "specs");
const stageReport = [];

if (fs.existsSync(specsRoot)) {
  for (const entry of fs.readdirSync(specsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Reserved scratch/template directories are not features.
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const dir = path.join("specs", entry.name);
    const hasSpec = exists(path.join(dir, "spec.md"));
    const hasPlan = exists(path.join(dir, "plan.md"));
    const hasTasks = exists(path.join(dir, "tasks.md"));

    const stage = hasTasks ? "tasked" : hasPlan ? "planned" : hasSpec ? "spec-only" : "empty";
    stageReport.push(`${dir} [${stage}]`);

    // A feature directory always starts from a specification.
    if (!hasSpec) {
      errors.push(
        `${dir}: missing spec.md. Every feature directory must begin with a spec; ` +
          `plan.md and tasks.md are downstream artifacts and cannot exist on their own.`
      );
    }

    // Stage 1 gate: spec.md must satisfy the specification contract.
    if (hasSpec) {
      const text = read(path.join(dir, "spec.md"));
      for (const heading of [
        "## Upstream Traceability",
        "## Scope",
        "## Acceptance Scenarios",
        "## Acceptance Evidence",
      ]) {
        if (!text.includes(heading)) errors.push(`${dir}/spec.md: missing required section "${heading}"`);
      }
      const upstreamPattern = /\b(?:U(?:0[1-9]|1\d|20)|V1-[CDX]\d{2}|A\d{4}|010\d{2})\b/;
      if (!upstreamPattern.test(text)) {
        errors.push(`${dir}/spec.md: no approved upstream requirement/node identifier found`);
      }
    }

    // Stage 2 gate: plan.md must satisfy the planning contract and have a spec behind it.
    if (hasPlan) {
      if (!hasSpec) errors.push(`${dir}: plan.md exists but spec.md is missing (Spec Kit lifecycle violation)`);
      const text = read(path.join(dir, "plan.md"));
      for (const heading of ["## Upstream Traceability", "## Constitution Check", "## Verification Plan"]) {
        if (!text.includes(heading)) errors.push(`${dir}/plan.md: missing required section "${heading}"`);
      }
    }

    // Stage 3 gate: tasks.md requires both predecessors, and every task needs REQ + VERIFY.
    if (hasTasks) {
      if (!hasSpec) errors.push(`${dir}: tasks.md exists but spec.md is missing (Spec Kit lifecycle violation)`);
      if (!hasPlan) errors.push(`${dir}: tasks.md exists but plan.md is missing (Spec Kit lifecycle violation)`);

      const text = read(path.join(dir, "tasks.md"));
      const taskLines = text.split(/\r?\n/).filter((line) => /^- \[(?: |x|X)\] T\d{3,}\b/.test(line));
      if (taskLines.length === 0) errors.push(`${dir}/tasks.md: no implementation task lines found`);
      for (const line of taskLines) {
        if (!/\[REQ:[^\]]+\]/.test(line)) errors.push(`${dir}/tasks.md: task missing [REQ:...] -> ${line}`);
        if (!/\[VERIFY:[^\]]+\]/.test(line)) errors.push(`${dir}/tasks.md: task missing [VERIFY:...] -> ${line}`);
      }
    }
  }
}

if (stageReport.length) {
  console.log("Feature lifecycle:");
  for (const line of stageReport) console.log(`- ${line}`);
}

if (errors.length) {
  console.error("Spec governance validation FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Spec governance validation PASS");
