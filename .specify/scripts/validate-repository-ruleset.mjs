#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function parseArgs(argv) {
  const opts = { fixture: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fixture") {
      if (!argv[i + 1]) throw new Error("--fixture requires a JSON file");
      opts.fixture = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: validate-repository-ruleset.mjs [--fixture <ruleset.json>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.resolve(root, rel), "utf8"));
}

export function validateRuleset(ruleset, contract) {
  const errors = [];
  if (!ruleset || ruleset.id !== contract.rulesetId) {
    errors.push(`Ruleset id mismatch: expected ${contract.rulesetId}, got ${ruleset?.id}`);
    return errors;
  }
  if (ruleset.name !== contract.rulesetName) {
    errors.push(`Ruleset name mismatch: expected ${contract.rulesetName}, got ${ruleset.name}`);
  }
  if (ruleset.target !== contract.target) {
    errors.push(`Ruleset target mismatch: expected ${contract.target}, got ${ruleset.target}`);
  }
  if (ruleset.enforcement !== contract.enforcement) {
    errors.push(`Ruleset enforcement mismatch: expected ${contract.enforcement}, got ${ruleset.enforcement}`);
  }

  const refName = ruleset.conditions?.ref_name;
  const includedRefs = Array.isArray(refName?.include) ? refName.include : [];
  const excludedRefs = Array.isArray(refName?.exclude) ? refName.exclude : [];
  if (!includedRefs.includes("~DEFAULT_BRANCH")) {
    errors.push("Ruleset must protect the repository default branch via conditions.ref_name.include=~DEFAULT_BRANCH.");
  }
  if (excludedRefs.length > 0) {
    errors.push("Ruleset protecting main must not carry ref_name exclusions; current exclusions=" + excludedRefs.join(","));
  }

  const prRule = (ruleset.rules ?? []).find((rule) => rule?.type === "pull_request");
  if (!prRule) {
    errors.push("Ruleset is missing the pull_request rule.");
    return errors;
  }
  const p = prRule.parameters ?? {};
  const expected = contract.requiredPullRequestPolicy;
  if (p.required_review_thread_resolution !== expected.requiredReviewThreadResolution) {
    errors.push(
      `required_review_thread_resolution must be ${expected.requiredReviewThreadResolution}; current=${p.required_review_thread_resolution}`
    );
  }

  for (const ruleType of contract.requiredRuleTypes ?? []) {
    if (!(ruleset.rules ?? []).some((rule) => rule?.type === ruleType)) {
      errors.push(`Missing required ruleset rule: ${ruleType}`);
    }
  }

  const statusRule = (ruleset.rules ?? []).find((rule) => rule?.type === "required_status_checks");
  if (!statusRule) {
    errors.push("Ruleset is missing required_status_checks.");
  } else {
    const actualList = (statusRule.parameters?.required_status_checks ?? []).map((x) => x.context);
    const actual = new Set(actualList);
    const expectedChecks = new Set(contract.requiredStatusChecks);
    for (const name of contract.requiredStatusChecks) {
      if (!actual.has(name)) errors.push(`Missing required status check: ${name}`);
    }
    for (const name of actual) {
      if (!expectedChecks.has(name)) errors.push(`Unexpected required status check: ${name}`);
    }
    if (actualList.length !== actual.size) {
      errors.push("Required status checks must not contain duplicate contexts.");
    }
  }

  if (Array.isArray(ruleset.bypass_actors) && ruleset.bypass_actors.length > 0) {
    errors.push("Ruleset must not have bypass actors for this governance contract.");
  }
  return errors;
}

async function fetchRuleset(contract) {
  const repository = process.env.GITHUB_REPOSITORY || contract.repository;
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY/repository contract must be owner/repo.");
  }
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "xiaoshuyin-ruleset-governance-validator",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(
    `https://api.github.com/repos/${repository}/rulesets/${contract.rulesetId}`,
    { headers }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub Ruleset API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const contract = readJson(".specify/repository-ruleset-contract.json");
let ruleset;
try {
  ruleset = opts.fixture ? readJson(opts.fixture) : await fetchRuleset(contract);
} catch (error) {
  console.error(`Repository Ruleset validation FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const activePrRule = (ruleset.rules ?? []).find((rule) => rule?.type === "pull_request");
const activePrParameters = activePrRule?.parameters ?? {};
console.log(`Repository Ruleset informational human-review settings (not gates): required_approving_review_count=${activePrParameters.required_approving_review_count ?? "unset"}, require_last_push_approval=${activePrParameters.require_last_push_approval ?? "unset"}`);

const errors = validateRuleset(ruleset, contract);
if (errors.length > 0) {
  console.error("Repository Ruleset validation FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Repository Ruleset validation PASS: default-branch protection, review-thread resolution, exact required checks, no-bypass policy, deletion protection, and non-fast-forward protection match the Single Owner + AI governance contract.");
