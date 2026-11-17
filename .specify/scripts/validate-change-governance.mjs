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

const FRONT_MATTER_FIELDS = Object.freeze({
  VERSION: "> 版本：",
  UPDATED_DATE: "> 更新日期：",
});
const FRONT_MATTER_EXCLUDABLE_PREFIXES = new Set(Object.values(FRONT_MATTER_FIELDS));

function extractSelector(content, selector, label, errors) {
  if (selector?.kind === "WHOLE_DOCUMENT") return content;
  const lines = content.split(/\r?\n/);

  if (selector?.kind === "FRONT_MATTER_METADATA") {
    if (!Array.isArray(selector.fields) || selector.fields.length === 0) {
      errors.push(label + ": FRONT_MATTER_METADATA requires finite fields[].");
      return null;
    }
    const selected = [];
    for (const field of selector.fields) {
      const prefix = FRONT_MATTER_FIELDS[field];
      if (!prefix) {
        errors.push(label + ": unsupported front-matter field " + String(field));
        return null;
      }
      const hits = lines.filter((line) => line.startsWith(prefix));
      if (hits.length !== 1) {
        errors.push(label + ": front-matter field " + field + " must occur exactly once, found " + hits.length + ".");
        return null;
      }
      selected.push(hits[0]);
    }
    return selected.join("\n");
  }

  if (!["MARKDOWN_SECTION", "MARKDOWN_SECTION_SHALLOW"].includes(selector?.kind) ||
      typeof selector.heading !== "string" || !/^#{1,6}\s+\S/.test(selector.heading)) {
    errors.push(label + ": selector must be WHOLE_DOCUMENT, FRONT_MATTER_METADATA, MARKDOWN_SECTION, or MARKDOWN_SECTION_SHALLOW.");
    return null;
  }
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
    if (candidate !== null && (selector.kind === "MARKDOWN_SECTION_SHALLOW" || candidate <= level)) {
      end = i;
      break;
    }
  }
  let selected = lines.slice(start, end);
  if (selector.excludeLinePrefixes !== undefined) {
    if (selector.kind !== "MARKDOWN_SECTION_SHALLOW" || !Array.isArray(selector.excludeLinePrefixes)) {
      errors.push(label + ": excludeLinePrefixes is only valid on MARKDOWN_SECTION_SHALLOW.");
      return null;
    }
    for (const prefix of selector.excludeLinePrefixes) {
      if (!FRONT_MATTER_EXCLUDABLE_PREFIXES.has(prefix)) {
        errors.push(label + ": unsupported excluded line prefix " + String(prefix));
        return null;
      }
    }
    selected = selected.filter((line) => !selector.excludeLinePrefixes.some((prefix) => line.startsWith(prefix)));
  }
  return selected.join("\n");
}

function loadAuthorityRegistry(errors) {
  const registry = readJson(AUTHORITY_UNIT_REGISTRY, errors, "Authority Unit registry");
  if (!registry) return null;
  if (registry.schemaVersion !== 2 || !Array.isArray(registry.documents)) {
    errors.push("Authority Unit registry must have schemaVersion=2 and documents[].");
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

    let currentDoc = "";
    try {
      currentDoc = fs.readFileSync(path.join(root, doc.path), "utf8");
    } catch {
      errors.push(label + ": cannot read Authority Doc for structural coverage.");
    }
    const expectedHeadings = currentDoc.split(/\r?\n/).filter((line) => /^#{1,6}\s+\S/.test(line));
    const registeredHeadings = doc.units
      .filter((unit) => ["MARKDOWN_SECTION", "MARKDOWN_SECTION_SHALLOW"].includes(unit?.selector?.kind))
      .map((unit) => unit.selector.heading);
    assertExactSet(registeredHeadings, expectedHeadings, label + " structural heading coverage", errors);

    for (const [uIndex, unit] of doc.units.entries()) {
      const uLabel = label + ".units[" + uIndex + "]";
      if (typeof unit?.id !== "string" || !unit.id) errors.push(uLabel + ": id is required.");
      else if (seenUnits.has(unit.id)) errors.push(uLabel + ": duplicate global unit id " + unit.id);
      else seenUnits.add(unit.id);
      if (typeof unit?.normative !== "boolean") errors.push(uLabel + ": normative boolean is required.");
      if (!["IMPLEMENTED", "FUTURE_UNIMPLEMENTED", "NON_NORMATIVE"].includes(unit?.lifecycle)) {
        errors.push(uLabel + ": lifecycle must be IMPLEMENTED, FUTURE_UNIMPLEMENTED, or NON_NORMATIVE.");
      }

      const kind = unit?.selector?.kind;
      if (!["MARKDOWN_SECTION", "MARKDOWN_SECTION_SHALLOW", "FRONT_MATTER_METADATA"].includes(kind)) {
        errors.push(uLabel + ": Authority Unit selector.kind is invalid or too broad.");
      }
      if (["MARKDOWN_SECTION", "MARKDOWN_SECTION_SHALLOW"].includes(kind) &&
          (typeof unit.selector.heading !== "string" || !/^#{1,6}\s+\S/.test(unit.selector.heading))) {
        errors.push(uLabel + ": markdown selector requires an exact heading.");
      }
      if (kind === "FRONT_MATTER_METADATA") {
        assertExactSet(unit.selector.fields ?? [], ["VERSION", "UPDATED_DATE"], uLabel + " metadata field set", errors);
      }
      if (!Array.isArray(unit?.downstreamBindings)) {
        errors.push(uLabel + ": downstreamBindings must be an array.");
        continue;
      }

      if (unit.normative) {
        if (unit.lifecycle === "IMPLEMENTED" && unit.downstreamBindings.length === 0) {
          errors.push(uLabel + ": IMPLEMENTED normative unit requires finite downstreamBindings.");
        }
        if (unit.lifecycle === "FUTURE_UNIMPLEMENTED") {
          if (unit.downstreamBindings.length !== 0) errors.push(uLabel + ": FUTURE_UNIMPLEMENTED unit must not invent downstream bindings.");
          if (typeof unit.futureReason !== "string" || !unit.futureReason.trim()) errors.push(uLabel + ": FUTURE_UNIMPLEMENTED unit requires futureReason.");
        }
        if (unit.lifecycle === "NON_NORMATIVE") errors.push(uLabel + ": normative unit cannot use NON_NORMATIVE lifecycle.");
      } else {
        if (unit.lifecycle !== "NON_NORMATIVE") errors.push(uLabel + ": non-normative unit must use NON_NORMATIVE lifecycle.");
        if (unit.downstreamBindings.length !== 0) errors.push(uLabel + ": non-normative unit must not declare downstream bindings.");
        if (!Array.isArray(unit.allowedNoImpactKinds) || unit.allowedNoImpactKinds.length === 0) {
          errors.push(uLabel + ": non-normative unit requires finite allowedNoImpactKinds[].");
        }
      }

      for (const [bIndex, binding] of unit.downstreamBindings.entries()) {
        const bLabel = uLabel + ".downstreamBindings[" + bIndex + "]";
        if (typeof binding?.feature !== "string" || !binding.feature) errors.push(bLabel + ": feature is required.");
        if (binding?.specPath !== "specs/" + binding?.feature) errors.push(bLabel + ": specPath must equal specs/<feature>.");
        validateFeatureExists(binding?.feature, errors, bLabel);
        if (!Array.isArray(binding?.requirements) || binding.requirements.length === 0) {
          errors.push(bLabel + ": requirements[] must be non-empty.");
          continue;
        }
        for (const [rIndex, req] of binding.requirements.entries()) {
          const rLabel = bLabel + ".requirements[" + rIndex + "]";
          if (typeof req?.id !== "string" || !req.id) errors.push(rLabel + ": id is required.");
          if (!req?.selector || !["WHOLE_DOCUMENT", "MARKDOWN_SECTION"].includes(req.selector.kind)) errors.push(rLabel + ": selector is invalid.");
          if (!Array.isArray(req?.requiredArtifacts) || req.requiredArtifacts.length === 0) errors.push(rLabel + ": requiredArtifacts[] must be non-empty.");
          const specFile = binding.specPath + "/spec.md";
          if (fs.existsSync(path.join(root, specFile))) {
            const specText = fs.readFileSync(path.join(root, specFile), "utf8");
            extractSelector(specText, req.selector, rLabel + " current requirement selector", errors);
          }
          for (const artifact of req?.requiredArtifacts ?? []) {
            if (typeof artifact !== "string" || !artifact || !fs.existsSync(path.join(root, artifact))) {
              errors.push(rLabel + ": registered required artifact does not exist: " + String(artifact));
            }
          }
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
      AUTHORITY_DOCS.includes(file) || /^specs\/[^/]+\/spec\.md$/.test(file) || isProductPath(file) || file.startsWith(".specify/authority-impacts/")
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

    if (unit.lifecycle === "FUTURE_UNIMPLEMENTED") {
      errors.push("FUTURE_UNIMPLEMENTED Authority Unit " + unit.id + " has no implemented downstream binding; topology must land in a separate governance change before this Authority Unit can change.");
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

    const expectedDownstream = unit.downstreamBindings.flatMap((binding) =>
      binding.requirements.map((req) => binding.feature + "\0" + binding.specPath + "\0" + req.id)
    );
    const actualDownstream = downstream.map((target) =>
      String(target?.feature) + "\0" + String(target?.specPath) + "\0" + String(target?.requirementId)
    );
    assertExactSet(actualDownstream, expectedDownstream, "Authority Unit " + unit.id + " downstream convergence set", errors);

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
    const req = line.match(/\[REQ:(.*?)\]/);
    const verify = line.match(/\[VERIFY:(.*)\]\s*$/);
    records.push({
      id: match[2],
      checked: match[1] !== " ",
      req: req ? req[1].trim() : null,
      verify: verify ? verify[1].trim() : null,
    });
  }
  return records;
}

function extractVerificationPatterns(verify) {
  if (typeof verify !== "string") return [];
  return [...new Set(verify.match(/(?:tests|scripts|\.github\/workflows|\.specify\/scripts)\/[A-Za-z0-9_.*?\/-]+/g) || [])];
}

function globMatches(pattern, value) {
  let source = "";
  for (const ch of pattern) {
    if (ch === "*") source += ".*";
    else if (ch === "?") source += ".";
    else source += /[\\^$.*+?()[\]{}|]/.test(ch) ? "\\" + ch : ch;
  }
  return new RegExp("^" + source + "$").test(value);
}

function isAllowedVerificationPath(rel) {
  return /^(tests\/|scripts\/|\.github\/workflows\/|\.specify\/scripts\/)/.test(rel);
}

function loadTaskProvenanceRegistry(errors) {
  if (!fs.existsSync(path.join(root, TASK_PROVENANCE_REGISTRY))) return { schemaVersion: 2, sharedRemediations: [] };
  const registry = readJson(TASK_PROVENANCE_REGISTRY, errors, "Task provenance registry");
  if (!registry) return { schemaVersion: 2, sharedRemediations: [] };
  if (registry.schemaVersion !== 2 || !Array.isArray(registry.sharedRemediations)) {
    errors.push("Task provenance registry must have schemaVersion=2 and sharedRemediations[].");
    return { schemaVersion: 2, sharedRemediations: [] };
  }
  const ids = new Set();
  for (const [index, binding] of registry.sharedRemediations.entries()) {
    const label = "Task provenance sharedRemediations[" + index + "]";
    if (typeof binding?.id !== "string" || !binding.id) errors.push(label + ": id is required.");
    else if (ids.has(binding.id)) errors.push(label + ": duplicate id " + binding.id);
    else ids.add(binding.id);
    if (typeof binding?.sourceFeature !== "string" || !binding.sourceFeature) errors.push(label + ": sourceFeature is required.");
    if (!Array.isArray(binding?.targetFeatures) || binding.targetFeatures.length === 0) errors.push(label + ": targetFeatures[] must be finite and non-empty.");
    if (!Number.isInteger(binding?.implementationPr) || binding.implementationPr <= 0) errors.push(label + ": implementationPr must be a positive integer.");
    if (Array.isArray(binding?.targetFeatures) && binding.targetFeatures.includes(binding.sourceFeature)) {
      errors.push(label + ": sourceFeature cannot self-target.");
    }
  }
  return registry;
}

function validateTaskVerificationMapping(evidence, records, evidenceRel, errors) {
  const checkedIds = records.map((r) => r.id);
  if (!Array.isArray(evidence.taskIds)) errors.push(evidenceRel + ": taskIds must be an array.");
  else assertExactSet(evidence.taskIds, checkedIds, evidenceRel + " checked task evidence", errors);

  if (!Array.isArray(evidence.taskVerifications)) {
    errors.push(evidenceRel + ": taskVerifications must be an array.");
    return new Set();
  }
  assertExactSet(evidence.taskVerifications.map((x) => x?.taskId), checkedIds, evidenceRel + " task-specific verification mapping", errors);
  const mappingByTask = new Map(evidence.taskVerifications.map((x) => [x?.taskId, x]));
  const used = new Set();

  for (const record of records) {
    if (!record.req) errors.push(evidenceRel + ": checked task " + record.id + " has no [REQ:...] contract.");
    if (!record.verify) errors.push(evidenceRel + ": checked task " + record.id + " has no [VERIFY:...] contract.");
    const mapping = mappingByTask.get(record.id);
    if (!mapping) continue;
    if (mapping.reqContract !== record.req) errors.push(evidenceRel + ": " + record.id + " REQ contract mismatch.");
    if (mapping.verifyContract !== record.verify) errors.push(evidenceRel + ": " + record.id + " VERIFY contract mismatch.");
    if (!Array.isArray(mapping.verificationPaths) || mapping.verificationPaths.length === 0) {
      errors.push(evidenceRel + ": completed task " + record.id + " has no task-specific verification artifact.");
      continue;
    }
    const patterns = extractVerificationPatterns(record.verify);
    if (patterns.length === 0) {
      errors.push(evidenceRel + ": completed task " + record.id + " VERIFY contract has no machine-verifiable repository path; task cannot be recorded complete.");
      continue;
    }
    for (const rel of mapping.verificationPaths) {
      if (typeof rel !== "string" || !isAllowedVerificationPath(rel)) {
        errors.push(evidenceRel + ": " + record.id + " verification path is outside allowed roots: " + String(rel));
        continue;
      }
      if (!patterns.some((pattern) => globMatches(pattern, rel))) {
        errors.push(evidenceRel + ": " + record.id + " verification path is not authorized by task VERIFY contract: " + rel);
      }
      if (!evidence.verificationPaths?.includes(rel)) errors.push(evidenceRel + ": " + record.id + " verification path is missing from evidence.verificationPaths: " + rel);
      if (!evidence.artifactPaths?.includes(rel)) errors.push(evidenceRel + ": " + record.id + " verification path is missing from evidence.artifactPaths: " + rel);
      if (!fs.existsSync(path.join(root, rel))) errors.push(evidenceRel + ": " + record.id + " verification artifact does not exist: " + rel);
      used.add(rel);
    }
  }

  if (!Array.isArray(evidence.verificationPaths)) errors.push(evidenceRel + ": verificationPaths must be an array.");
  else assertExactSet(evidence.verificationPaths, [...used], evidenceRel + " verificationPaths task ownership (no orphan verification)", errors);
  return used;
}

function validateTaskCompletionEvidence(changed, opts, errors) {
  const specsRoot = path.join(root, "specs");
  if (!fs.existsSync(specsRoot)) return;

  const provenanceRegistry = loadTaskProvenanceRegistry(errors);
  if (changed.includes(TASK_PROVENANCE_REGISTRY)) {
    for (const rel of changed.filter((file) => /^\.specify\/task-evidence\/[^/]+\.json$/.test(file))) {
      const evidence = readJson(rel, errors, "Changed task evidence " + rel);
      if (evidence?.provenanceKind === "SHARED_REMEDIATION") {
        errors.push("Task provenance registry changes cannot self-authorize SHARED_REMEDIATION evidence in the same change: " + rel);
      }
    }
  }

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

  const provenanceUses = [];
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

    if (evidence.schemaVersion !== 3) errors.push(evidenceRel + ": schemaVersion must be 3.");
    if (evidence.featureId !== entry.name) errors.push(evidenceRel + ": task feature identity mismatch; featureId must equal " + entry.name + ".");
    if (evidence.taskFile !== taskRel) errors.push(evidenceRel + ": taskFile must equal " + taskRel + ".");
    if (!["FEATURE_IMPLEMENTATION", "SHARED_REMEDIATION"].includes(evidence.provenanceKind)) {
      errors.push(evidenceRel + ": provenanceKind must be FEATURE_IMPLEMENTATION or SHARED_REMEDIATION.");
    }

    let sharedBinding = null;
    if (evidence.provenanceKind === "SHARED_REMEDIATION") {
      sharedBinding = provenanceRegistry.sharedRemediations.find((x) => x?.id === evidence.sharedRemediationBindingId);
      if (!sharedBinding || !sharedBinding.targetFeatures?.includes(entry.name) || sharedBinding.implementationPr !== evidence.implementationPr) {
        errors.push(evidenceRel + ": shared remediation relationship is not registered.");
      }
    }
    provenanceUses.push({ feature: entry.name, kind: evidence.provenanceKind, implementationPr: evidence.implementationPr, sharedBinding });

    if (!Number.isInteger(evidence.implementationPr) || evidence.implementationPr <= 0) errors.push(evidenceRel + ": implementationPr must be a positive integer.");
    for (const field of ["implementationHeadSha", "mergeCommitSha"]) {
      if (typeof evidence[field] !== "string" || !/^[0-9a-f]{40}$/.test(evidence[field])) errors.push(evidenceRel + ": " + field + " must be a 40-char commit SHA.");
    }

    validateTaskVerificationMapping(evidence, records, evidenceRel, errors);

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

  const byPr = new Map();
  for (const use of provenanceUses) {
    if (!Number.isInteger(use.implementationPr)) continue;
    if (!byPr.has(use.implementationPr)) byPr.set(use.implementationPr, []);
    byPr.get(use.implementationPr).push(use);
  }
  for (const [pr, uses] of byPr.entries()) {
    if (uses.length <= 1) continue;
    const direct = uses.filter((x) => x.kind === "FEATURE_IMPLEMENTATION");
    if (direct.length !== 1) {
      errors.push("Implementation PR #" + pr + " cannot be reused as universal evidence through SHARED_REMEDIATION; exactly one source FEATURE_IMPLEMENTATION provenance is required.");
      continue;
    }
    for (const use of uses.filter((x) => x.kind === "SHARED_REMEDIATION")) {
      if (!use.sharedBinding || use.sharedBinding.sourceFeature !== direct[0].feature) {
        errors.push("Implementation PR #" + pr + " cannot be reused as universal evidence for " + use.feature + "; SHARED_REMEDIATION source relationship is invalid.");
      }
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
validateTaskCompletionEvidence(changed, opts, errors);

if (errors.length > 0) {
  console.error("Change governance FAILED:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}
console.log("Change governance PASS");
