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

function ruleset({
  approvals = 0,
  lastPush = false,
  threadResolution = true,
  checks = statusChecks,
  bypassActors = [],
  id = 27341100,
  name = "main-protection",
  target = "branch",
  enforcement = "active",
  includeRefs = ["~DEFAULT_BRANCH"],
  excludeRefs = [],
  deletion = true,
  nonFastForward = true,
}) {
  const rules = [
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: approvals,
        require_last_push_approval: lastPush,
        required_review_thread_resolution: threadResolution,
      },
    },
    {
      type: "required_status_checks",
      parameters: {
        required_status_checks: checks.map((context) => ({ context })),
      },
    },
  ];
  if (deletion) rules.push({ type: "deletion" });
  if (nonFastForward) rules.push({ type: "non_fast_forward" });

  return {
    id,
    name,
    target,
    enforcement,
    conditions: {
      ref_name: {
        include: includeRefs,
        exclude: excludeRefs,
      },
    },
    bypass_actors: bypassActors,
    rules,
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
    name: "G6 wrong Ruleset identity is rejected",
    expected: 1,
    actual: run(ruleset({ id: 99999999 })),
    marker: "Ruleset id mismatch",
  },
  {
    name: "G6 ruleset not protecting the default branch is rejected",
    expected: 1,
    actual: run(ruleset({ includeRefs: ["refs/heads/not-main"] })),
    marker: "must protect the repository default branch",
  },
  {
    name: "G6 ruleset excluding the default branch is rejected",
    expected: 1,
    actual: run(ruleset({ excludeRefs: ["~DEFAULT_BRANCH"] })),
    marker: "must not carry ref_name exclusions",
  },
  {
    name: "G6 review-thread resolution disabled is rejected",
    expected: 1,
    actual: run(ruleset({ threadResolution: false })),
    marker: "required_review_thread_resolution",
  },
  {
    name: "G6 required status check missing is rejected",
    expected: 1,
    actual: run(ruleset({
      checks: statusChecks.filter((context) => context !== "Spec Governance"),
    })),
    marker: "Missing required status check: Spec Governance",
  },
  {
    name: "G6 unexpected required status check is rejected",
    expected: 1,
    actual: run(ruleset({ checks: [...statusChecks, "Unapproved Check"] })),
    marker: "Unexpected required status check: Unapproved Check",
  },
  {
    name: "G6 bypass actor introduced is rejected",
    expected: 1,
    actual: run(ruleset({
      bypassActors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }],
    })),
    marker: "Ruleset must not have bypass actors",
  },
  {
    name: "G6 deletion protection missing is rejected",
    expected: 1,
    actual: run(ruleset({ deletion: false })),
    marker: "Missing required ruleset rule: deletion",
  },
  {
    name: "G6 non-fast-forward protection missing is rejected",
    expected: 1,
    actual: run(ruleset({ nonFastForward: false })),
    marker: "Missing required ruleset rule: non_fast_forward",
  },
  {
    name: "G6 single-owner ruleset with zero human approvals and no last-push approval passes",
    expected: 0,
    actual: run(ruleset({ approvals: 0, lastPush: false })),
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
