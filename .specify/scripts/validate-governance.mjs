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

const specsRoot = path.join(root, "specs");
if (fs.existsSync(specsRoot)) {
  for (const entry of fs.readdirSync(specsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join("specs", entry.name);
    const spec = path.join(dir, "spec.md");
    const plan = path.join(dir, "plan.md");
    const tasks = path.join(dir, "tasks.md");

    if (!exists(spec)) errors.push(`${dir}: missing spec.md`);
    if (!exists(plan)) errors.push(`${dir}: missing plan.md`);
    if (!exists(tasks)) errors.push(`${dir}: missing tasks.md`);

    if (exists(spec)) {
      const text = read(spec);
      for (const heading of ["## Upstream Traceability", "## Scope", "## Acceptance Scenarios", "## Acceptance Evidence"]) {
        if (!text.includes(heading)) errors.push(`${spec}: missing required section "${heading}"`);
      }
      const upstreamPattern = /\b(?:U(?:0[1-9]|1\d|20)|V1-[CDX]\d{2}|A\d{4}|010\d{2})\b/;
      if (!upstreamPattern.test(text)) {
        errors.push(`${spec}: no approved upstream requirement/node identifier found`);
      }
    }

    if (exists(plan)) {
      const text = read(plan);
      for (const heading of ["## Upstream Traceability", "## Constitution Check", "## Verification Plan"]) {
        if (!text.includes(heading)) errors.push(`${plan}: missing required section "${heading}"`);
      }
    }

    if (exists(tasks)) {
      const text = read(tasks);
      const taskLines = text.split(/\r?\n/).filter((line) => /^- \[ \] T\d{3,}\b/.test(line));
      if (taskLines.length === 0) errors.push(`${tasks}: no implementation task lines found`);
      for (const line of taskLines) {
        if (!/\[REQ:[^\]]+\]/.test(line)) errors.push(`${tasks}: task missing [REQ:...] -> ${line}`);
        if (!/\[VERIFY:[^\]]+\]/.test(line)) errors.push(`${tasks}: task missing [VERIFY:...] -> ${line}`);
      }
    }
  }
}

if (errors.length) {
  console.error("Spec governance validation FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Spec governance validation PASS");
