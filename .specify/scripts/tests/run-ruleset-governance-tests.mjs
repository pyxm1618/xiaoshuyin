#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const validator = path.resolve(here, "..", "validate-repository-ruleset.mjs");
const root = path.resolve(here, "..", "..", "..");

const statusChecks = ["Contract","Static Checks","DB Migration","Unit Tests","Integration Tests","Spec Governance"];
function ruleset({ approvals, lastPush }) {
  return {
    id: 27341100,
    name: "main-protection",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    rules: [
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: approvals,
          require_last_push_approval: lastPush,
          required_review_thread_resolution: true,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          required_status_checks: statusChecks.map((context) => ({ context })),
        },
      },
      { type: "deletion" },
      { type: "non_fast_forward" },
    ],
  };
}

function run(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-ruleset-"));
  const file = path.join(dir, "ruleset.json");
  fs.writeFileSync(file, JSON.stringify(fixture), "utf8");
  const result = spawnSync(process.execPath, [validator, "--fixture", file], {
    cwd: root,
    encoding: "utf8",
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const cases = [
  {
    name: "G6 required approval count 0 is rejected",
    expected: 1,
    actual: run(ruleset({ approvals: 0, lastPush: true })),
    marker: "required_approving_review_count",
  },
  {
    name: "G7 missing latest-push approval is rejected",
    expected: 1,
    actual: run(ruleset({ approvals: 1, lastPush: false })),
    marker: "require_last_push_approval",
  },
  {
    name: "G6/G7 native review protections satisfy the contract",
    expected: 0,
    actual: run(ruleset({ approvals: 1, lastPush: true })),
    marker: "Repository Ruleset validation PASS",
  },
];

let failed = 0;
for (const item of cases) {
  const pass = item.actual.code === item.expected && item.actual.out.includes(item.marker);
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${item.name} — expected exit ${item.expected}, got ${item.actual.code}`);
  if (!pass) console.log(item.actual.out);
}
if (failed) {
  console.error(`Ruleset governance self-test FAILED: ${failed}/${cases.length}`);
  process.exit(1);
}
console.log(`Ruleset governance self-test PASS: ${cases.length}/${cases.length}`);
