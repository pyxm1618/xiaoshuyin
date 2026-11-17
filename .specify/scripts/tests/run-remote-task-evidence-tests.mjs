#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const validator = path.resolve(here, "..", "validate-task-evidence-remote.mjs");

if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
  console.error("Remote task evidence adversarial tests require GITHUB_TOKEN and GITHUB_REPOSITORY.");
  process.exit(1);
}

const canonical = JSON.parse(
  fs.readFileSync(path.join(root, ".specify", "task-evidence", "010-compliance-feature-policy-foundation.json"), "utf8")
);

function runCase(manifests) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xiaoshuyin-remote-evidence-"));
  for (const [name, value] of Object.entries(manifests)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
  }
  const result = spawnSync(process.execPath, [validator], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TASK_EVIDENCE_DIR: dir },
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: result.status, out: (result.stdout ?? "") + (result.stderr ?? "") };
}

const cases = [];

{
  const attack = {
    ...canonical,
    featureId: "004-case-participant-core",
    taskFile: "specs/004-case-participant-core/tasks.md",
  };
  cases.push({
    name: "G5-C1 unrelated real merged PR plus successful real CI is rejected",
    expected: 1,
    marker: "feature identity mismatch",
    actual: runCase({ "004-case-participant-core.json": attack }),
  });
}

{
  const attack = {
    ...canonical,
    artifactPaths: [...canonical.artifactPaths, "README.md"],
  };
  cases.push({
    name: "G5-C2 correct PR with artifact outside PR delta is rejected",
    expected: 1,
    marker: "artifact not present in implementation PR delta: README.md",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

{
  cases.push({
    name: "G5-C3 correct feature, PR, actual artifacts and verification evidence pass",
    expected: 0,
    marker: "feature/PR-delta/verification provenance verified",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": canonical }),
  });
}

{
  const attack = {
    ...canonical,
    featureId: "004-case-participant-core",
    taskFile: "specs/004-case-participant-core/tasks.md",
  };
  cases.push({
    name: "G5-C4 task feature identity mismatch is rejected",
    expected: 1,
    marker: "does not match manifest filename",
    actual: runCase({ "010-compliance-feature-policy-foundation.json": attack }),
  });
}

{
  const attack = {
    ...canonical,
    featureId: "004-case-participant-core",
    taskFile: "specs/004-case-participant-core/tasks.md",
  };
  cases.push({
    name: "G5-C5 one successful PR cannot be reused as universal task evidence",
    expected: 1,
    marker: "cannot be reused as universal evidence",
    actual: runCase({
      "010-compliance-feature-policy-foundation.json": canonical,
      "004-case-participant-core.json": attack,
    }),
  });
}

let failed = 0;
for (const item of cases) {
  const pass = item.actual.code === item.expected && item.actual.out.includes(item.marker);
  if (!pass) failed += 1;
  console.log((pass ? "PASS" : "FAIL") + "  " + item.name + " — expected exit " + item.expected + ", got " + item.actual.code);
  if (!pass) {
    console.log("      expected marker: " + item.marker);
    console.log(item.actual.out.split("\n").map((line) => "      " + line).join("\n"));
  }
}
if (failed > 0) {
  console.error("Remote task evidence adversarial self-test FAILED: " + failed + "/" + cases.length);
  process.exit(1);
}
console.log("Remote task evidence adversarial self-test PASS: " + cases.length + "/" + cases.length);
