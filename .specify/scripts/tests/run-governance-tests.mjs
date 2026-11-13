#!/usr/bin/env node
/**
 * Self-test for the Xiaoshuyin governance gate.
 *
 * Proves the validator accepts the legitimate Spec Kit lifecycle and still
 * rejects every broken combination, and that the Docs gate enforces the
 * approval override. Runs against throwaway fixtures in the OS temp directory,
 * never against the repository working tree.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const validator = path.resolve(here, "..", "validate-governance.mjs");
const docsGuard = path.resolve(here, "..", "check-docs-guard.mjs");

const MANDATORY_FILES = [
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

const SPEC_MD = `# Feature Specification: fixture

## Upstream Traceability
- U01

## Scope
In scope: fixture.

## Acceptance Scenarios
1. Fixture passes.

## Acceptance Evidence
- unit test
`;

const PLAN_MD = `# Implementation Plan: fixture

## Upstream Traceability
- U01

## Constitution Check
- PASS

## Verification Plan
- unit test
`;

const ANNOTATED_SPEC_MD = `# Feature Specification: annotated fixture

## Upstream Traceability
- U01

## Scope（§2A）
In scope: fixture.

## Acceptance Scenarios（§18）
1. Fixture passes.

## Acceptance Evidence（§20）
- unit test
`;

const buildTasks = ({ req = "[REQ:U01]", verify = "[VERIFY:unit test]" } = {}) => `# Tasks: fixture

- [ ] T001 do the thing ${req} ${verify}
`;

const STRUCTURED_SPEC_MD = `# Feature Specification: structured fixture

## 1. Scope
In scope: fixture.

## 2. Upstream Traceability
- U01

## 3. Acceptance Scenarios
1. Fixture passes.
`;

const STRUCTURED_PLAN_MD = `# Implementation Plan: structured fixture

## 1. Authority Gate
- PASS

## 2. Frozen Requirement Traceability
- U01

## 3. Scope Contract
- constrained

## 4. Verification Strategy
- unit test
`;

const STRUCTURED_TASKS_MD = `# Tasks: structured fixture

## Frozen Spec Authority Map
| Task | Authority |
| --- | --- |
| T1201 | U01 |

## T1201 — Do the thing
### Goal
Implement fixture.
### Verification
- unit test

## Acceptance Evidence Contract
- scenario evidence
`;

function writeFile(root, rel, content) {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-gov-"));
  for (const rel of MANDATORY_FILES) writeFile(root, rel, "placeholder\n");
  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  return root;
}

function run(script, cwd, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return {
    code: result.status,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

const results = [];

function record(name, expectCode, actual, note = "") {
  const pass = actual.code === expectCode;
  results.push({ name, expectCode, actualCode: actual.code, pass, note, out: actual.out });
  return pass;
}

function featureDir(root, name) {
  const dir = path.join(root, "specs", name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------- Cases A–F
{
  const root = makeProject();
  const dir = featureDir(root, "001-spec-only");
  writeFile(root, path.join("specs", "001-spec-only", "spec.md"), SPEC_MD);
  record("A spec-only feature passes", 0, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  featureDir(root, "002-plan-without-spec");
  writeFile(root, path.join("specs", "002-plan-without-spec", "plan.md"), PLAN_MD);
  record("B plan.md without spec.md fails", 1, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  featureDir(root, "003-tasks-without-plan");
  writeFile(root, path.join("specs", "003-tasks-without-plan", "spec.md"), SPEC_MD);
  writeFile(root, path.join("specs", "003-tasks-without-plan", "tasks.md"), buildTasks());
  record("C tasks.md without plan.md fails", 1, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  featureDir(root, "004-complete");
  writeFile(root, path.join("specs", "004-complete", "spec.md"), SPEC_MD);
  writeFile(root, path.join("specs", "004-complete", "plan.md"), PLAN_MD);
  writeFile(root, path.join("specs", "004-complete", "tasks.md"), buildTasks());
  record("D spec+plan+tasks with REQ and VERIFY passes", 0, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  featureDir(root, "004b-structured-complete");
  writeFile(root, path.join("specs", "004b-structured-complete", "spec.md"), STRUCTURED_SPEC_MD);
  writeFile(root, path.join("specs", "004b-structured-complete", "plan.md"), STRUCTURED_PLAN_MD);
  writeFile(root, path.join("specs", "004b-structured-complete", "tasks.md"), STRUCTURED_TASKS_MD);
  record("D2 numbered headings + structured tasks pass", 0, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  featureDir(root, "005-missing-req");
  writeFile(root, path.join("specs", "005-missing-req", "spec.md"), SPEC_MD);
  writeFile(root, path.join("specs", "005-missing-req", "plan.md"), PLAN_MD);
  writeFile(root, path.join("specs", "005-missing-req", "tasks.md"), buildTasks({ req: "" }));
  record("E task without [REQ:...] fails", 1, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  featureDir(root, "006-missing-verify");
  writeFile(root, path.join("specs", "006-missing-verify", "spec.md"), SPEC_MD);
  writeFile(root, path.join("specs", "006-missing-verify", "plan.md"), PLAN_MD);
  writeFile(root, path.join("specs", "006-missing-verify", "tasks.md"), buildTasks({ verify: "" }));
  record("F task without [VERIFY:...] fails", 1, run(validator, root));
  cleanup(root);
}

for (const fixture of [
  { name: "completed lowercase task passes", tasks: "- [x] T001 done [REQ:U01] [VERIFY:unit test]", code: 0 },
  { name: "completed uppercase task passes", tasks: "- [X] T001 done [REQ:U01] [VERIFY:unit test]", code: 0 },
  { name: "mixed completed and pending tasks pass", tasks: "- [x] T001 done [REQ:U01] [VERIFY:unit test]\n- [ ] T002 pending [REQ:U01] [VERIFY:unit test]", code: 0 },
  { name: "completed task without REQ fails", tasks: "- [x] T001 done [VERIFY:unit test]", code: 1, error: "task missing [REQ:...]" },
  { name: "completed task without VERIFY fails", tasks: "- [x] T001 done [REQ:U01]", code: 1, error: "task missing [VERIFY:...]" },
]) {
  const root = makeProject();
  const dir = "008-task-status";
  featureDir(root, dir);
  writeFile(root, path.join("specs", dir, "spec.md"), SPEC_MD);
  writeFile(root, path.join("specs", dir, "plan.md"), PLAN_MD);
  writeFile(root, path.join("specs", dir, "tasks.md"), `# Tasks: fixture\n\n${fixture.tasks}\n`);
  const actual = run(validator, root);
  const pass = record(fixture.name, fixture.code, actual);
  if (pass && fixture.error && !actual.out.includes(fixture.error)) {
    results[results.length - 1].pass = false;
    results[results.length - 1].note = `missing expected error: ${fixture.error}`;
  }
  cleanup(root);
}


{
  const root = makeProject();
  const dir = "009-annotated-section-suffixes";
  featureDir(root, dir);
  writeFile(root, path.join("specs", dir, "spec.md"), ANNOTATED_SPEC_MD);
  record("annotated reviewed section suffixes pass", 0, run(validator, root));
  cleanup(root);
}

{
  const root = makeProject();
  const dir = "010-lookalike-section-boundaries";
  featureDir(root, dir);
  writeFile(
    root,
    path.join("specs", dir, "spec.md"),
    SPEC_MD.replace("## Scope", "## ScopeGuard")
  );
  const actual = run(validator, root);
  const pass = record("lookalike section prefix does not pass", 1, actual);
  if (pass && !actual.out.includes('missing required section "## Scope"')) {
    results[results.length - 1].pass = false;
    results[results.length - 1].note = "missing expected Scope error";
  }
  cleanup(root);
}

// ---------------------------------------------------------------- Cases G–H
const DOCS_CHANGES = ["Docs/V1产品需求.md", "Docs/reference/legacy-digital-use-requirements.md"];
const NON_DOCS_CHANGES = [".specify/README.md", "AGENTS.md"];

function docsFixture(lines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-docs-"));
  const file = path.join(root, "changed.txt");
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  return { root, file };
}

{
  const { root, file } = docsFixture(DOCS_CHANGES);
  const actual = run(docsGuard, root, ["--changed-files", file, "--labels", "chore,internal", "--mode", "enforce"]);
  record("G Docs change without approval fails", 1, actual);
  cleanup(root);
}

{
  const { root, file } = docsFixture(DOCS_CHANGES);
  const actual = run(docsGuard, root, [
    "--changed-files",
    file,
    "--labels",
    "chore,approved-docs-change",
    "--mode",
    "enforce",
  ]);
  const mentionsAudit = /Audit note/.test(actual.out) && /PRESENT/.test(actual.out);
  const pass = record("H approved Docs override passes the Docs gate", 0, actual, mentionsAudit ? "" : "missing audit note");
  if (pass && !mentionsAudit) results[results.length - 1].pass = false;
  cleanup(root);
}

{
  const { root, file } = docsFixture(NON_DOCS_CHANGES);
  record("I no Docs change passes without a label", 0, run(docsGuard, root, ["--changed-files", file, "--mode", "enforce"]));
  cleanup(root);
}

{
  // The label admits Docs to review; it must never mask another governance failure.
  const root = makeProject();
  featureDir(root, "007-broken-with-override");
  writeFile(root, path.join("specs", "007-broken-with-override", "spec.md"), SPEC_MD);
  writeFile(root, path.join("specs", "007-broken-with-override", "plan.md"), PLAN_MD);
  writeFile(root, path.join("specs", "007-broken-with-override", "tasks.md"), buildTasks({ verify: "" }));
  const validation = run(validator, root);
  const { file } = docsFixture(DOCS_CHANGES);
  const guard = run(docsGuard, root, ["--changed-files", file, "--labels", "approved-docs-change", "--mode", "enforce"]);
  const pass = validation.code === 1 && guard.code === 0;
  results.push({
    name: "H2 override does not disable other governance checks",
    expectCode: 1,
    actualCode: validation.code,
    pass,
    note: `docs gate=${guard.code}`,
    out: validation.out,
  });
  cleanup(root);
}

// ---------------------------------------------------------------- report
let failed = 0;
for (const item of results) {
  if (!item.pass) failed += 1;
  const status = item.pass ? "PASS" : "FAIL";
  const note = item.note ? ` (${item.note})` : "";
  console.log(`${status}  ${item.name} — expected exit ${item.expectCode}, got ${item.actualCode}${note}`);
  if (!item.pass) console.log(item.out.trim().split("\n").map((line) => `      ${line}`).join("\n"));
}

if (failed > 0) {
  console.error(`\nGovernance self-test FAILED: ${failed}/${results.length} case(s) did not behave as required.`);
  process.exit(1);
}

console.log(`\nGovernance self-test PASS: ${results.length}/${results.length} cases.`);
