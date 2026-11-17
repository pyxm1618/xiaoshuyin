#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const AUTHORITY_DOCS = Object.freeze([
  "Docs/总产品需求.md",
  "Docs/V1产品需求.md",
  "Docs/总体技术架构.md",
  "Docs/V1技术设计.md",
]);
const PRODUCT_PREFIXES = Object.freeze(["apps/", "packages/", "db/"]);
const FIXED_EXEMPT_PREFIXES = Object.freeze([
  ".specify/",
  ".github/",
  "specs/",
  "tests/",
  "scripts/",
  "Docs/",
]);
const FIXED_EXEMPT_FILES = new Set(["AGENTS.md"]);
const INFRA_EXEMPTION_CLASSES = new Set(["BUILD_TOOLING", "REPOSITORY_METADATA"]);
const OWNERSHIP_REGISTRY = ".specify/implementation-ownership.json";
const AUTHORITY_UNIT_REGISTRY = ".specify/authority-unit-registry.json";
const TASK_PROVENANCE_REGISTRY = ".specify/task-provenance-registry.json";

function parseArgs(argv) {
  const opts = {
    base: process.env.GOVERNANCE_BASE || "origin/main",
    head: process.env.GOVERNANCE_HEAD || "HEAD",
    changedFiles: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (argv[i + 1] === undefined) throw new Error("Missing value for " + arg);
      i += 1;
      return argv[i];
    };
    if (arg === "--base") opts.base = next();
    else if (arg === "--head") opts.head = next();
    else if (arg === "--changed-files") opts.changedFiles = next();
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: validate-change-governance.mjs [--base <ref>] [--head <ref>] [--changed-files <file>]");
      process.exit(0);
    } else throw new Error("Unknown argument: " + arg);
  }
  return opts;
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: options.binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitOk(args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" }).status === 0;
}

function changedFiles(opts) {
  if (opts.changedFiles) {
    return fs.readFileSync(opts.changedFiles, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return git([
    "-c", "core.quotePath=false",
    "diff", "--name-only", "-z", "--diff-filter=ACDMRTUXB",
    opts.base + "..." + opts.head,
  ]).split("\0").filter(Boolean);
}

function isProductPath(file) {
  return PRODUCT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isFixedExemptPath(file) {
  return FIXED_EXEMPT_FILES.has(file) || FIXED_EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function readJson(rel, errors, label = rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  } catch (error) {
    errors.push(label + ": invalid or unreadable JSON (" + (error instanceof Error ? error.message : String(error)) + ")");
    return null;
  }
}

function gitBlobSha(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const header = Buffer.from("blob " + buffer.length + "\0");
  return crypto.createHash("sha1").update(header).update(buffer).digest("hex");
}

function blobAt(ref, rel) {
  return git(["show", ref + ":" + rel], { binary: true });
}

function textAt(ref, rel) {
  return git(["show", ref + ":" + rel]);
}

function currentBlobSha(rel) {
  return gitBlobSha(fs.readFileSync(path.join(root, rel)));
}

function assertExactSet(actualValues, expectedValues, label, errors) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    errors.push(label + ": expected [" + expected.join(", ") + "], got [" + actual.join(", ") + "]");
  }
}

function validateFeatureExists(feature, errors, label) {
  if (typeof feature !== "string" || !feature || !fs.existsSync(path.join(root, "specs", feature, "spec.md"))) {
    errors.push(label + ": feature must resolve to an authoritative specs/<feature>/spec.md: " + String(feature));
    return false;
  }
  return true;
}

function loadOwnershipRegistry(errors) {
  const registry = readJson(OWNERSHIP_REGISTRY, errors, "Implementation ownership registry");
  if (!registry) return null;
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.rules) || registry.rules.length === 0) {
    errors.push("Implementation ownership registry must have schemaVersion=1 and non-empty rules[].");
    return null;
  }
  const ids = new Set();
  const keys = new Set();
  for (const [index, rule] of registry.rules.entries()) {
    const label = "Implementation ownership rule[" + index + "]";
    if (!rule || typeof rule.id !== "string" || !rule.id) errors.push(label + ": id is required.");
    else if (ids.has(rule.id)) errors.push(label + ": duplicate id " + rule.id);
    else ids.add(rule.id);

    const kind = rule?.match?.kind;
    const matchPath = rule?.match?.path;
    if (!["EXACT", "PREFIX"].includes(kind) || typeof matchPath !== "string" || !isProductPath(matchPath)) {
      errors.push(label + ": match must be EXACT/PREFIX on a production path.");
      continue;
    }
    if (/[*?\[\]{}]/.test(matchPath)) errors.push(label + ": wildcard ownership is forbidden: " + matchPath);
    if (kind === "PREFIX" && !matchPath.endsWith("/") && !matchPath.endsWith("-")) {
      errors.push(label + ": PREFIX path must end with / or a deliberate lexical prefix marker '-': " + matchPath);
    }
    const key = kind + ":" + matchPath;
    if (keys.has(key)) errors.push(label + ": duplicate ownership matcher " + key);
    keys.add(key);

    const ownershipKind = rule?.ownership?.kind;
    const features = rule?.ownership?.features;
    if (!["FEATURE", "SHARED"].includes(ownershipKind) || !Array.isArray(features) || features.length === 0) {
      errors.push(label + ": ownership.kind must be FEATURE/SHARED with finite non-empty features[].");
      continue;
    }
    if (new Set(features).size !== features.length) errors.push(label + ": duplicate feature ownership entries are forbidden.");
    if (ownershipKind === "FEATURE" && features.length !== 1) errors.push(label + ": FEATURE ownership must have exactly one feature.");
    for (const feature of features) validateFeatureExists(feature, errors, label);
  }
  return registry;
}

function resolveOwnership(registry, rel) {
  const matches = [];
  for (const rule of registry.rules) {
    const kind = rule?.match?.kind;
    const p = rule?.match?.path;
    if (typeof p !== "string") continue;
    if ((kind === "EXACT" && rel === p) || (kind === "PREFIX" && rel.startsWith(p))) {
      matches.push(rule);
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.match.path.length - a.match.path.length);
  const bestLength = matches[0].match.path.length;
  const best = matches.filter((x) => x.match.path.length === bestLength);
  if (best.length !== 1) return { ambiguous: true, rules: best };
  return { ambiguous: false, rule: best[0] };
}

function validateChangeBinding(changed, errors) {
  const productChanged = changed.filter(isProductPath).sort();
  const unknownChanged = changed.filter((file) => !isProductPath(file) && !isFixedExemptPath(file)).sort();
  const bindingFiles = changed.filter((file) => /^\.specify\/change-bindings\/[^/]+\.json$/.test(file));
  const registryChanged = changed.includes(OWNERSHIP_REGISTRY);

  if (registryChanged && (productChanged.length > 0 || bindingFiles.length > 0)) {
    errors.push("Implementation ownership registry changes cannot coexist with product implementation/change-binding changes; registry governance must land separately.");
  }

  let registry = null;
  if (productChanged.length > 0 || registryChanged) registry = loadOwnershipRegistry(errors);

  if (productChanged.length === 0 && unknownChanged.length === 0) {
    if (bindingFiles.length > 0) errors.push("Change binding manifest changed even though no product or unclassified repository path changed.");
    return;
  }

  if (bindingFiles.length !== 1) {
    errors.push("Exactly one changed .specify/change-bindings/*.json manifest is required when product/unclassified paths change; found " + bindingFiles.length + ".");
    return;
  }

  const manifest = readJson(bindingFiles[0], errors, "Change binding manifest");
  if (!manifest) return;
  if (![1, 2].includes(manifest.schemaVersion)) errors.push("Change binding manifest schemaVersion must be 1 or 2.");
  if (typeof manifest.changeId !== "string" || !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(manifest.changeId)) {
    errors.push("Change binding manifest changeId is missing or invalid.");
  }

  if (productChanged.length > 0) {
    if (manifest.classification !== "FEATURE_IMPLEMENTATION") {
      errors.push("Product implementation changes require classification FEATURE_IMPLEMENTATION.");
      return;
    }
    if (!Array.isArray(manifest.featureBindings) || manifest.featureBindings.length === 0) {
      errors.push("FEATURE_IMPLEMENTATION requires non-empty featureBindings.");
      return;
    }
    if (!registry) {
      errors.push("Product implementation changes require the repository-controlled implementation ownership registry.");
      return;
    }

    const boundPaths = [];
    for (const [index, binding] of manifest.featureBindings.entries()) {
      const prefix = "featureBindings[" + index + "]";
      if (typeof binding?.feature !== "string" || !binding.feature) errors.push(prefix + ".feature is required.");
      if (typeof binding?.specPath !== "string" || !/^specs\/[^/]+$/.test(binding.specPath)) {
        errors.push(prefix + ".specPath must be an authoritative specs/<feature> directory.");
      } else {
        const expectedFeature = path.posix.basename(binding.specPath);
        if (binding.feature !== expectedFeature) errors.push(prefix + ".feature must equal spec directory basename " + expectedFeature + ".");
        if (!fs.existsSync(path.join(root, binding.specPath, "spec.md"))) {
          errors.push(prefix + ".specPath has no authoritative spec.md: " + binding.specPath);
        }
      }
      if (!Array.isArray(binding?.implementationPaths) || binding.implementationPaths.length === 0) {
        errors.push(prefix + ".implementationPaths must be non-empty.");
        continue;
      }
      for (const rel of binding.implementationPaths) {
        if (typeof rel !== "string" || !isProductPath(rel)) {
          errors.push(prefix + ".implementationPaths contains a non-product path: " + String(rel));
          continue;
        }
        boundPaths.push(rel);
        const resolved = resolveOwnership(registry, rel);
        if (!resolved) {
          errors.push("No registered implementation ownership for production path: " + rel);
          continue;
        }
        if (resolved.ambiguous) {
          errors.push("Ambiguous implementation ownership for production path: " + rel);
          continue;
        }
        const allowed = resolved.rule.ownership.features;
        if (!allowed.includes(binding.feature)) {
          errors.push(
            "Implementation ownership mismatch for " + rel + ": feature " + binding.feature +
            " is not authorized by registry rule " + resolved.rule.id + " (allowed: " + allowed.join(", ") + ")."
          );
        }
      }
    }

    if (new Set(boundPaths).size !== boundPaths.length) {
      errors.push("Product implementation path is bound more than once; bindings must be exact and unambiguous.");
    }
    assertExactSet(boundPaths, productChanged, "Product implementation binding", errors);
    if (unknownChanged.length > 0) {
      errors.push("FEATURE_IMPLEMENTATION cannot absorb unclassified repository paths: " + unknownChanged.join(", "));
    }
    return;
  }

  if (manifest.classification !== "REPOSITORY_INFRASTRUCTURE") {
    errors.push("Unclassified non-product paths require classification REPOSITORY_INFRASTRUCTURE.");
    return;
  }
  if (!INFRA_EXEMPTION_CLASSES.has(manifest.exemptionClass)) {
    errors.push("REPOSITORY_INFRASTRUCTURE exemptionClass must be one of: " + [...INFRA_EXEMPTION_CLASSES].join(", "));
  }
  if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) {
    errors.push("REPOSITORY_INFRASTRUCTURE requires non-empty paths.");
    return;
  }
  if (manifest.paths.some((rel) => isProductPath(rel))) {
    errors.push("REPOSITORY_INFRASTRUCTURE cannot exempt product implementation paths.");
  }
  assertExactSet(manifest.paths, unknownChanged, "Repository infrastructure exemption", errors);
}

function headingLevel(line) {
  const m = line.match(/^(#{1,6})\s+/);
  return m ? m[1].length : null;
}

function extractSelector(content, selector, label, errors) {
  if (selector?.kind === "WHOLE_DOCUMENT") return content;
  if (selector?.kind !== "MARKDOWN_SECTION" || typeof selector.heading !== "string" || !/^#{1,6}\s+\S/.test(selector.heading)) {
    errors.push(label + ": selector must be WHOLE_DOCUMENT or exact MARKDOWN_SECTION heading.");
    return null;
  }
  const lines = content.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) if (lines[i] === selector.heading) hits.push(i);
  if (hits.length !== 1) {
    errors.push(label + ": exact heading must occur once, found " + hits.length + ": " + selector.heading);
    return null;
  }
  const start = hits[0];
  const level = headingLevel(lines[start]);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const candidate = headingLevel(lines[i]);
    if (candidate !== null && candidate <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function loadAuthorityRegistry(errors) {
  const registry = readJson(AUTHORITY_UNIT_REGISTRY, errors, "Authority Unit registry");
  if (!registry) return null;
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.documents)) {
    errors.push("Authority Unit registry must have schemaVersion=1 and documents[].");
    return null;
  }
  const seenUnits = new Set();
  const seenDocs = new Set();
  for (const [dIndex, doc] of registry.documents.entries()) {
    const label = "Authority Unit registry documents[" + dIndex + "]";
    if (!AUTHORITY_DOCS.includes(doc?.path)) errors.push(label + ": path must be one of the four Authority Docs.");
    if (seenDocs.has(doc?.path)) errors.push(label + ": duplicate Authority document path.");
    seenDocs.add(doc?.path);
    if (!Array.isArray(doc?.units) || doc.units.length === 0) {
      errors.push(label + ": units[] must be non-empty.");
      continue;
    }
    for (const [uIndex, unit] of doc.units.entries()) {
      const uLabel = label + ".units[" + uIndex + "]";
      if (typeof unit?.id !== "string" || !unit.id) errors.push(uLabel + ": id is required.");
      else if (seenUnits.has(unit.id)) errors.push(uLabel + ": duplicate global unit id " + unit.id);
      else seenUnits.add(unit.id);
      if (typeof unit?.normative !== "boolean") errors.push(uLabel + ": normative boolean is required.");
      if (!unit?.selector || !["WHOLE_DOCUMENT", "MARKDOWN_SECTION"].includes(unit.selector.kind)) {
        errors.push(uLabel + ": selector.kind is invalid.");
      }
      if (unit?.selector?.kind === "MARKDOWN_SECTION" && (typeof unit.selector.heading !== "string" || !/^#{1,6}\s+\S/.test(unit.selector.heading))) {
        errors.push(uLabel + ": MARKDOWN_SECTION requires an exact markdown heading.");
      }
      if (!Array.isArray(unit?.downstreamBindings)) errors.push(uLabel + ": downstreamBindings must be an array.");
      for (const [bIndex, binding] of (unit?.downstreamBindings ?? []).entries()) {
        const bLabel = uLabel + ".downstreamBindings[" + bIndex + "]";
        if (typeof binding?.feature !== "string" || !binding.feature) errors.push(bLabel + ": feature is required.");
        if (binding?.specPath !== "specs/" + binding?.feature) errors.push(bLabel + ": specPath must equal specs/<feature>.");
        if (!Array.isArray(binding?.requirements) || binding.requirements.length === 0) {
          errors.push(bLabel + ": requirements[] must be non-empty.");
          continue;
        }
        for (const [rIndex, req] of binding.requirements.entries()) {
          const rLabel = bLabel + ".requirements[" + rIndex + "]";
          if (typeof req?.id !== "string" || !req.id) errors.push(rLabel + ": id is required.");
          if (!req?.selector || !["WHOLE_DOCUMENT", "MARKDOWN_SECTION"].includes(req.selector.kind)) errors.push(rLabel + ": selector is invalid.");
          if (!Array.isArray(req?.requiredArtifacts) || req.requiredArtifacts.length === 0) errors.push(rLabel + ": requiredArtifacts[] must be non-empty.");
        }
      }
      if (!unit.normative) {
        if (!Array.isArray(unit.allowedNoImpactKinds) || unit.allowedNoImpactKinds.length === 0) {
          errors.push(uLabel + ": non-normative unit requires finite allowedNoImpactKinds[].");
        }
      }
    }
  }
  assertExactSet([...seenDocs], AUTHORITY_DOCS, "Authority Unit registry document set", errors);
  return registry;
}

function unitMap(registry) {
  const map = new Map();
  for (const doc of registry.documents) for (const unit of doc.units) map.set(unit.id, { doc, unit });
  return map;
}

function validateAuthorityImpact(changed, opts, errors) {
  const authorityChanged = changed.filter((file) => AUTHORITY_DOCS.includes(file)).sort();
  const impactFiles = changed.filter((file) => /^\.specify\/authority-impacts\/[^/]+\.json$/.test(file));
  const registryChanged = changed.includes(AUTHORITY_UNIT_REGISTRY);

  if (registryChanged) {
    loadAuthorityRegistry(errors);
    const forbidden = changed.filter((file) =>
      AUTHORITY_DOCS.includes(file) || /^specs\\/[^/]+\\/spec\\.md$/.test(file) || isProductPath(file) || file.startsWith(".specify/authority-impacts/")
    );
    if (forbidden.length > 0) {
      errors.push("Authority Unit registry changes are governance-sensitive and must land separately from Authority Docs, specs, production, and impact contracts: " + forbidden.join(", "));
    }
  }

  if (authorityChanged.length === 0) {
    if (impactFiles.length > 0) errors.push("Authority impact manifest changed without an Authority Doc change; reusable/pre-seeded impact declarations are forbidden.");
    return;
  }

  if (registryChanged) {
    errors.push("Authority Doc changes cannot self-authorize by changing the Authority Unit registry in the same PR.");
    return;
  }
  const registry = loadAuthorityRegistry(errors);
  if (!registry) return;

  if (!changed.includes(".specify/authority-inputs.json")) {
    errors.push("Authority Docs changed but .specify/authority-inputs.json was not refreshed in the same change.");
  }
  if (impactFiles.length !== 1) {
    errors.push("Authority Docs changed: exactly one changed .specify/authority-impacts/*.json declaration is required; found " + impactFiles.length + ".");
    return;
  }

  const manifest = readJson(impactFiles[0], errors, "Authority impact manifest");
  if (!manifest) return;
  if (manifest.schemaVersion !== 2) errors.push("Authority impact manifest schemaVersion must be 2.");
  if (manifest.status !== "CONVERGED") errors.push("Authority impact manifest status must be CONVERGED.");
  if (typeof manifest.changeId !== "string" || !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(manifest.changeId)) {
    errors.push("Authority impact manifest changeId is missing or invalid.");
  }
  if (!Array.isArray(manifest.authorityChanges)) {
    errors.push("Authority impact manifest authorityChanges must be an array.");
    return;
  }
  assertExactSet(manifest.authorityChanges.map((x) => x?.path), authorityChanged, "Authority impact changed document set", errors);

  const changedUnitIds = [];
  const units = unitMap(registry);
  for (const item of manifest.authorityChanges) {
    if (!item || !AUTHORITY_DOCS.includes(item.path)) continue;
    let previous;
    let next;
    let previousText;
    let nextText;
    try {
      previous = gitBlobSha(blobAt(opts.base, item.path));
      next = gitBlobSha(blobAt(opts.head, item.path));
      previousText = textAt(opts.base, item.path);
      nextText = textAt(opts.head, item.path);
    } catch (error) {
      errors.push("Cannot resolve authority blobs for " + item.path + ": " + (error instanceof Error ? error.message : String(error)));
      continue;
    }
    if (item.previousBlobSha !== previous) errors.push("Authority impact previousBlobSha mismatch for " + item.path + ": expected " + previous);
    if (item.newBlobSha !== next) errors.push("Authority impact newBlobSha mismatch for " + item.path + ": expected " + next);
    if (previous === next) errors.push("Authority impact lists unchanged document: " + item.path);

    const doc = registry.documents.find((d) => d.path === item.path);
    if (!doc) {
      errors.push("No Authority Unit registry entry for changed document: " + item.path);
      continue;
    }
    for (const unit of doc.units) {
      const before = extractSelector(previousText, unit.selector, "Authority Unit " + unit.id + " at base", errors);
      const after = extractSelector(nextText, unit.selector, "Authority Unit " + unit.id + " at head", errors);
      if (before !== null && after !== null && before !== after) changedUnitIds.push(unit.id);
    }
  }

  if (!Array.isArray(manifest.unitImpacts)) {
    errors.push("Authority impact manifest unitImpacts must be an array.");
    return;
  }
  assertExactSet(manifest.unitImpacts.map((x) => x?.authorityUnitId), changedUnitIds, "Changed Authority Unit impact set", errors);

  const specOrProductChanges = changed.filter((file) => file.startsWith("specs/") || isProductPath(file));
  for (const impact of manifest.unitImpacts) {
    const registered = units.get(impact?.authorityUnitId);
    if (!registered) {
      errors.push("Unknown Authority Unit in impact contract: " + String(impact?.authorityUnitId));
      continue;
    }
    const unit = registered.unit;
    const downstream = Array.isArray(impact?.downstream) ? impact.downstream : [];

    if (!unit.normative) {
      if (impact.classification !== "NO_DOWNSTREAM_IMPACT") {
        errors.push("Non-normative Authority Unit " + unit.id + " may only use NO_DOWNSTREAM_IMPACT.");
      }
      if (downstream.length !== 0) errors.push("NO_DOWNSTREAM_IMPACT unit " + unit.id + " must not declare downstream.");
      if (!unit.allowedNoImpactKinds?.includes(impact?.exemption?.kind)) {
        errors.push("NO_DOWNSTREAM_IMPACT exemption is not mechanically authorized for Authority Unit " + unit.id + ".");
      }
      if (specOrProductChanges.length > 0) {
        errors.push("NO_DOWNSTREAM_IMPACT cannot coexist with spec/product deltas: " + specOrProductChanges.join(", "));
      }
      continue;
    }

    if (!["AFFECTS_EXISTING_FEATURES", "CREATES_FUTURE_REQUIREMENT"].includes(impact.classification)) {
      errors.push("Substantive Authority Unit " + unit.id + " cannot use " + String(impact.classification) + "; downstream convergence is required.");
      continue;
    }
    if (downstream.length === 0) {
      errors.push("Substantive Authority Unit " + unit.id + " requires non-empty downstream convergence.");
      continue;
    }

    for (const [dIndex, target] of downstream.entries()) {
      const label = "Authority Unit " + unit.id + " downstream[" + dIndex + "]";
      const binding = unit.downstreamBindings.find((b) => b.feature === target?.feature && b.specPath === target?.specPath);
      if (!binding) {
        errors.push(label + ": wrong authority→spec binding; feature/spec is not registered.");
        continue;
      }
      const requirement = binding.requirements.find((r) => r.id === target?.requirementId);
      if (!requirement) {
        errors.push(label + ": downstream requirement identity is not registered: " + String(target?.requirementId));
        continue;
      }
      const specFile = binding.specPath + "/spec.md";
      if (!changed.includes(specFile)) errors.push(label + ": linked downstream spec.md was not changed: " + specFile);
      let beforeSpec = null;
      let afterSpec = null;
      try {
        if (gitOk(["cat-file", "-e", opts.base + ":" + specFile])) beforeSpec = textAt(opts.base, specFile);
        afterSpec = textAt(opts.head, specFile);
      } catch (error) {
        errors.push(label + ": cannot read linked downstream spec: " + (error instanceof Error ? error.message : String(error)));
        continue;
      }
      if (impact.classification === "AFFECTS_EXISTING_FEATURES" && beforeSpec === null) {
        errors.push(label + ": existing-feature impact requires the spec to exist at base.");
        continue;
      }
      const afterReq = extractSelector(afterSpec, requirement.selector, label + " requirement at head", errors);
      let beforeReq = null;
      if (beforeSpec !== null) beforeReq = extractSelector(beforeSpec, requirement.selector, label + " requirement at base", errors);
      if (impact.classification === "AFFECTS_EXISTING_FEATURES" && beforeReq === afterReq) {
        errors.push(label + ": linked downstream requirement did not change: " + requirement.id);
      }
      if (impact.classification === "CREATES_FUTURE_REQUIREMENT" && afterReq === null) {
        errors.push(label + ": future requirement selector is absent at head: " + requirement.id);
      }

      const declaredArtifacts = Array.isArray(target?.requiredArtifacts) ? target.requiredArtifacts : [];
      assertExactSet(declaredArtifacts, requirement.requiredArtifacts, label + " required artifact set", errors);
      for (const artifact of requirement.requiredArtifacts) {
        if (typeof artifact !== "string" || !artifact || artifact.startsWith("Docs/") || artifact.startsWith("specs/") || artifact.startsWith(".specify/authority-")) {
          errors.push(label + ": invalid registered downstream artifact: " + String(artifact));
          continue;
        }
        if (!changed.includes(artifact)) errors.push(label + ": registered downstream artifact was not changed: " + artifact);
        if (!fs.existsSync(path.join(root, artifact))) errors.push(label + ": registered downstream artifact is missing at HEAD: " + artifact);
      }
    }
  }
}

function parseTaskRecords(content, checkedOnly = false) {
  const records = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^- \[([ xX])\] (T\d{3,})\b/);
    if (!match) continue;
    if (checkedOnly && match[1] === " ") continue;
    const verify = line.match(/\[VERIFY:(.*)\]\s*$/);
    records.push({ id: match[2], checked: match[1] !== " ", verify: verify ? verify[1].trim() : null });
  }
  return records;
}

function verificationDigest(records) {
  const canonical = records.map((r) => r.id + "\0" + (r.verify ?? "")).join("\n");
  return gitBlobSha(Buffer.from(canonical, "utf8"));
}

function loadTaskProvenanceRegistry(errors) {
  if (!fs.existsSync(path.join(root, TASK_PROVENANCE_REGISTRY))) return { schemaVersion: 1, sharedRemediations: [] };
  const registry = readJson(TASK_PROVENANCE_REGISTRY, errors, "Task provenance registry");
  if (!registry) return { schemaVersion: 1, sharedRemediations: [] };
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.sharedRemediations)) {
    errors.push("Task provenance registry must have schemaVersion=1 and sharedRemediations[].");
    return { schemaVersion: 1, sharedRemediations: [] };
  }
  return registry;
}

function validateTaskCompletionEvidence(errors) {
  const specsRoot = path.join(root, "specs");
  if (!fs.existsSync(specsRoot)) return;

  const baselinePath = ".specify/legacy-task-completion-baseline.json";
  let baseline = { schemaVersion: 1, files: [] };
  if (fs.existsSync(path.join(root, baselinePath))) baseline = readJson(baselinePath, errors, "Legacy task completion baseline") || baseline;
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.files)) {
    errors.push("Legacy task completion baseline must have schemaVersion=1 and files[].");
    baseline = { schemaVersion: 1, files: [] };
  }
  const baselineByPath = new Map();
  for (const entry of baseline.files) {
    if (!entry || typeof entry.path !== "string" || !/^[0-9a-f]{40}$/.test(entry.blobSha || "")) {
      errors.push("Legacy task completion baseline contains an invalid entry.");
      continue;
    }
    if (baselineByPath.has(entry.path)) errors.push("Duplicate legacy task baseline entry: " + entry.path);
    baselineByPath.set(entry.path, entry.blobSha);
  }

  const provenanceRegistry = loadTaskProvenanceRegistry(errors);
  for (const entry of fs.readdirSync(specsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const taskRel = "specs/" + entry.name + "/tasks.md";
    const taskAbs = path.join(root, taskRel);
    if (!fs.existsSync(taskAbs)) continue;
    const content = fs.readFileSync(taskAbs, "utf8");
    const records = parseTaskRecords(content, true);
    const checkedIds = records.map((r) => r.id);
    if (checkedIds.length === 0) continue;

    const baselineSha = baselineByPath.get(taskRel);
    if (baselineSha && currentBlobSha(taskRel) === baselineSha) continue;

    const evidenceRel = ".specify/task-evidence/" + entry.name + ".json";
    if (!fs.existsSync(path.join(root, evidenceRel))) {
      errors.push(taskRel + ": completed tasks require " + evidenceRel + " unless the task file matches the finite legacy baseline.");
      continue;
    }
    const evidence = readJson(evidenceRel, errors, "Task evidence for " + entry.name);
    if (!evidence) continue;

    if (evidence.schemaVersion !== 2) errors.push(evidenceRel + ": schemaVersion must be 2.");
    if (evidence.featureId !== entry.name) errors.push(evidenceRel + ": task feature identity mismatch; featureId must equal " + entry.name + ".");
    if (evidence.taskFile !== taskRel) errors.push(evidenceRel + ": taskFile must equal " + taskRel + ".");
    if (!["FEATURE_IMPLEMENTATION", "SHARED_REMEDIATION"].includes(evidence.provenanceKind)) {
      errors.push(evidenceRel + ": provenanceKind must be FEATURE_IMPLEMENTATION or SHARED_REMEDIATION.");
    }
    if (evidence.provenanceKind === "SHARED_REMEDIATION") {
      const allowed = provenanceRegistry.sharedRemediations.some((x) =>
        x?.id === evidence.sharedRemediationBindingId &&
        Array.isArray(x.features) &&
        x.features.includes(entry.name) &&
        x.implementationPr === evidence.implementationPr
      );
      if (!allowed) errors.push(evidenceRel + ": shared remediation relationship is not registered.");
    }

    if (!Number.isInteger(evidence.implementationPr) || evidence.implementationPr <= 0) errors.push(evidenceRel + ": implementationPr must be a positive integer.");
    for (const field of ["implementationHeadSha", "mergeCommitSha"]) {
      if (typeof evidence[field] !== "string" || !/^[0-9a-f]{40}$/.test(evidence[field])) errors.push(evidenceRel + ": " + field + " must be a 40-char commit SHA.");
    }
    if (Array.isArray(evidence.taskIds)) assertExactSet(evidence.taskIds, checkedIds, evidenceRel + " checked task evidence", errors);
    else errors.push(evidenceRel + ": taskIds must be an array.");

    for (const record of records) if (!record.verify) errors.push(evidenceRel + ": checked task " + record.id + " has no [VERIFY:...] contract.");
    const digest = verificationDigest(records);
    if (evidence.taskVerificationDigest !== digest) {
      errors.push(evidenceRel + ": taskVerificationDigest mismatch; evidence is not bound to the current checked-task [VERIFY:] contracts.");
    }

    if (!Array.isArray(evidence.artifactPaths) || evidence.artifactPaths.length === 0) {
      errors.push(evidenceRel + ": artifactPaths must be non-empty.");
    } else {
      let substantive = false;
      for (const rel of evidence.artifactPaths) {
        if (typeof rel !== "string" || !fs.existsSync(path.join(root, rel))) {
          errors.push(evidenceRel + ": evidence artifact does not exist: " + String(rel));
          continue;
        }
        if (!fs.statSync(path.join(root, rel)).isFile()) {
          errors.push(evidenceRel + ": evidence artifact must be a concrete file, not a directory: " + rel);
          continue;
        }
        if (!rel.startsWith("specs/") && !rel.startsWith(".specify/")) substantive = true;
      }
      if (!substantive) errors.push(evidenceRel + ": artifactPaths must include implementation/test/governance evidence outside specs/.specify.");
    }

    if (!Array.isArray(evidence.verificationPaths) || evidence.verificationPaths.length === 0) {
      errors.push(evidenceRel + ": verificationPaths must be non-empty.");
    } else {
      for (const rel of evidence.verificationPaths) {
        if (!evidence.artifactPaths?.includes(rel)) errors.push(evidenceRel + ": verificationPath must also be an artifactPath: " + rel);
        if (!/^(tests\/|scripts\/|\.github\/workflows\/|\.specify\/scripts\/tests\/)/.test(rel)) {
          errors.push(evidenceRel + ": verificationPath must be a concrete test/script/workflow artifact: " + rel);
        }
      }
    }

    if (!Array.isArray(evidence.ciRuns) || evidence.ciRuns.length === 0) errors.push(evidenceRel + ": ciRuns must be non-empty.");
    else {
      for (const run of evidence.ciRuns) {
        if (!Number.isInteger(run?.runId) || run.runId <= 0 || typeof run?.name !== "string") errors.push(evidenceRel + ": invalid ciRuns entry.");
        else {
          if (run.conclusion !== "success") errors.push(evidenceRel + ": CI evidence must record conclusion=success.");
          if (run.headSha !== evidence.implementationHeadSha) errors.push(evidenceRel + ": CI run headSha must equal implementationHeadSha.");
        }
      }
    }

    if (/^[0-9a-f]{40}$/.test(evidence.implementationHeadSha || "") && !gitOk(["cat-file", "-e", evidence.implementationHeadSha + "^{commit}"])) {
      errors.push(evidenceRel + ": implementationHeadSha is not present in repository history.");
    }
    if (/^[0-9a-f]{40}$/.test(evidence.mergeCommitSha || "")) {
      if (!gitOk(["cat-file", "-e", evidence.mergeCommitSha + "^{commit}"])) errors.push(evidenceRel + ": mergeCommitSha is not present in repository history.");
      else if (!gitOk(["merge-base", "--is-ancestor", evidence.mergeCommitSha, "HEAD"])) errors.push(evidenceRel + ": mergeCommitSha is not an ancestor of current HEAD.");
    }
  }
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = [];
let changed = [];
try {
  changed = changedFiles(opts);
} catch (error) {
  console.error("Cannot compute governance diff " + opts.base + "..." + opts.head + ": " + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}

console.log("Change governance");
console.log("  revision range: " + opts.base + "..." + opts.head);
console.log("  changed files: " + changed.length);
console.log("  product implementation files: " + changed.filter(isProductPath).length);
console.log("  authority docs changed: " + changed.filter((file) => AUTHORITY_DOCS.includes(file)).length);

validateChangeBinding(changed, errors);
validateAuthorityImpact(changed, opts, errors);
validateTaskCompletionEvidence(errors);

if (errors.length > 0) {
  console.error("Change governance FAILED:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}
console.log("Change governance PASS");
