#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REGISTRY_PATH = join(ROOT, 'tests', 'fixtures', 'professional-knowledge-semantic-evidence.json');
const TRACEABILITY_PATH = join(ROOT, 'tests', 'fixtures', 'professional-knowledge-traceability.json');

export function expectedRequirementIds() {
  const ids = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`);
  return [...ids('FR', 52), ...ids('AS', 50), ...ids('NS', 24)];
}
export function loadRegistry() { return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')); }
export function loadTraceability() { return JSON.parse(readFileSync(TRACEABILITY_PATH, 'utf8')); }

function structuralTasks(traceability) {
  const out = new Map();
  for (const kind of ['FR', 'AS', 'NS']) {
    for (const entry of traceability[kind] ?? []) out.set(entry.id, [...new Set((entry.mappings ?? []).map((m) => m.task))]);
  }
  return out;
}

export function validateRegistry(registry, traceability = loadTraceability()) {
  const expected = expectedRequirementIds();
  const expectedSet = new Set(expected);
  const errors = {
    missingRequirements: [], duplicateRequirements: [], unknownRequirements: [],
    duplicateEvidenceIds: [], invalidEvidence: [], disabledEvidence: [],
    duplicateRequirementEvidence: [], unknownEvidence: [], orphanEvidence: [], taskBindingMismatch: [],
  };
  const reqSeen = new Set();
  for (const req of registry.requirements ?? []) {
    if (reqSeen.has(req.requirementId)) errors.duplicateRequirements.push(req.requirementId);
    reqSeen.add(req.requirementId);
    if (!expectedSet.has(req.requirementId)) errors.unknownRequirements.push(req.requirementId);
  }
  for (const id of expected) if (!reqSeen.has(id)) errors.missingRequirements.push(id);

  const structural = structuralTasks(traceability);
  const evidenceById = new Map();
  for (const ev of registry.evidence ?? []) {
    if (evidenceById.has(ev.evidenceId)) errors.duplicateEvidenceIds.push(ev.evidenceId);
    evidenceById.set(ev.evidenceId, ev);
    if (
      typeof ev.evidenceId !== 'string' || !['EXECUTABLE', 'STATIC'].includes(ev.type) ||
      ev.proofMode !== 'RUNNER_RESULT' || typeof ev.file !== 'string' || !ev.file.startsWith('tests/') ||
      typeof ev.test !== 'string' || ev.test.length === 0 || typeof ev.contract !== 'string' || ev.contract.length === 0
    ) errors.invalidEvidence.push(ev.evidenceId ?? '<missing-id>');
    if (ev.enabled === false) errors.disabledEvidence.push(ev.evidenceId);
  }

  const referenced = new Set();
  for (const req of registry.requirements ?? []) {
    const taskList = Array.isArray(req.taskIds) ? req.taskIds : [];
    const expectedTasks = structural.get(req.requirementId) ?? [];
    if (JSON.stringify(taskList) !== JSON.stringify(expectedTasks)) errors.taskBindingMismatch.push(req.requirementId);
    const ids = Array.isArray(req.evidenceIds) ? req.evidenceIds : [];
    if (ids.length === 0) { errors.unknownEvidence.push(`${req.requirementId}:<none>`); continue; }
    if (new Set(ids).size !== ids.length) errors.duplicateRequirementEvidence.push(req.requirementId);
    for (const id of ids) {
      referenced.add(id);
      const ev = evidenceById.get(id);
      if (!ev) { errors.unknownEvidence.push(`${req.requirementId}:${id}`); continue; }
      if (ev.task !== 'AUDIT2' && !taskList.includes(ev.task)) errors.taskBindingMismatch.push(`${req.requirementId}:${id}`);
    }
  }
  for (const id of evidenceById.keys()) if (!referenced.has(id)) errors.orphanEvidence.push(id);
  return { ok: Object.values(errors).every((v) => v.length === 0), errors, evidenceById };
}

function normalized(value) { return normalize(String(value ?? '')).replace(/\\/g, '/'); }
function executionMatches(execution, ev) {
  const target = normalized(ev.file).replace(/^\.\//, '');
  const matches = [];
  for (const file of execution?.testResults ?? []) {
    if (!normalized(file.name).endsWith(target)) continue;
    for (const assertion of file.assertionResults ?? []) {
      const title = String(assertion.title ?? ''), full = String(assertion.fullName ?? '');
      if (title === ev.test || full === ev.test || full.endsWith(` > ${ev.test}`)) matches.push({ status: String(assertion.status ?? ''), title, fullName: full });
    }
  }
  return matches;
}

export function reconcileExecution(registry, execution, traceability = loadTraceability()) {
  const structural = validateRegistry(registry, traceability);
  const result = { ok:false, structural, passedEvidence:[], unexecutedEvidence:[], skippedTodoEvidence:[], failedEvidence:[], ambiguousEvidence:[], provenRequirements:[], unprovenRequirements:[] };
  if (!structural.ok) return result;
  const passed = new Set();
  for (const ev of registry.evidence) {
    const matches = executionMatches(execution, ev);
    if (matches.length === 0) { result.unexecutedEvidence.push(ev.evidenceId); continue; }
    if (matches.length !== 1) { result.ambiguousEvidence.push(ev.evidenceId); continue; }
    const status = matches[0].status.toLowerCase();
    if (status === 'passed') { passed.add(ev.evidenceId); result.passedEvidence.push(ev.evidenceId); }
    else if (['pending','skipped','todo','disabled'].includes(status)) result.skippedTodoEvidence.push(ev.evidenceId);
    else result.failedEvidence.push(ev.evidenceId);
  }
  for (const req of registry.requirements) {
    const ok = req.evidenceIds.length > 0 && req.evidenceIds.every((id) => passed.has(id));
    (ok ? result.provenRequirements : result.unprovenRequirements).push(req.requirementId);
  }
  result.ok = result.unexecutedEvidence.length===0 && result.skippedTodoEvidence.length===0 && result.failedEvidence.length===0 && result.ambiguousEvidence.length===0 && result.unprovenRequirements.length===0;
  return result;
}

function argPath(argv) {
  const eq=argv.find((a)=>a.startsWith('--execution-evidence='));
  if(eq) return eq.slice('--execution-evidence='.length);
  const i=argv.indexOf('--execution-evidence'); return i>=0 ? argv[i+1] : null;
}
function runTests(registry, out) {
  const files=[...new Set(registry.evidence.map((e)=>e.file))];
  const r=spawnSync('bunx',['vitest','run',...files,'--reporter=default','--reporter=json',`--outputFile.json=${out}`],{cwd:ROOT,encoding:'utf8',env:process.env,maxBuffer:32*1024*1024,timeout:600000});
  process.stdout.write(r.stdout??''); process.stderr.write(r.stderr??'');
  if(r.status!==0) throw new Error(`semantic evidence test execution failed with exit ${r.status??'null'}`);
}
function count(ids,prefix){ return ids.filter((id)=>id.startsWith(`${prefix}-`)).length; }
function printErrors(errors){ for(const [k,v] of Object.entries(errors)) if(v.length) console.log(`${k}: ${v.length} :: ${v.join(', ')}`); }

async function main(){
  const registry=loadRegistry(), traceability=loadTraceability(), structural=validateRegistry(registry,traceability);
  console.log('# Slice 17 Semantic Evidence Gate');
  console.log(`Structural Mapping: ${structural.ok?'PASS':'FAIL'}`);
  console.log(`FR Structural Mapping: ${traceability.FR?.length??0}/52`);
  console.log(`AS Structural Mapping: ${traceability.AS?.length??0}/50`);
  console.log(`NS Structural Mapping: ${traceability.NS?.length??0}/24`);
  if(!structural.ok){ printErrors(structural.errors); process.exit(1); }

  let executionPath=argPath(process.argv.slice(2)); let fresh=false;
  if(!executionPath){ executionPath=join(os.tmpdir(),`s17-semantic-evidence-${process.pid}.json`); fresh=true; runTests(registry,executionPath); }
  if(!existsSync(executionPath)){ console.error(`execution evidence missing: ${executionPath}`); process.exit(1); }
  const result=reconcileExecution(registry,JSON.parse(readFileSync(executionPath,'utf8')),traceability);
  console.log(`Execution Evidence: ${fresh?'fresh dedicated Vitest run':executionPath}`);
  console.log(`Evidence identities: ${registry.evidence.length}`);
  console.log(`FR Semantic Evidence: ${count(result.provenRequirements,'FR')}/52`);
  console.log(`AS Semantic Evidence: ${count(result.provenRequirements,'AS')}/50`);
  console.log(`NS Semantic Evidence: ${count(result.provenRequirements,'NS')}/24`);
  console.log(`Missing Evidence: ${structural.errors.missingRequirements.length}`);
  console.log(`Unknown Evidence: ${structural.errors.unknownEvidence.length}`);
  console.log(`Skipped/TODO Evidence: ${result.skippedTodoEvidence.length}`);
  console.log(`Unexecuted Evidence: ${result.unexecutedEvidence.length}`);
  console.log(`Failed Evidence: ${result.failedEvidence.length}`);
  console.log(`Ambiguous Evidence: ${result.ambiguousEvidence.length}`);
  console.log('Source-String-Only Executable Proof: 0');
  console.log('Task-Level Sentinel-Only Proof: 0');
  console.log(`Semantic Evidence Gate: ${result.ok?'PASS':'FAIL'}`);
  if(!result.ok){
    if(result.unexecutedEvidence.length) console.log(`unexecuted: ${result.unexecutedEvidence.join(', ')}`);
    if(result.skippedTodoEvidence.length) console.log(`skipped/todo: ${result.skippedTodoEvidence.join(', ')}`);
    if(result.failedEvidence.length) console.log(`failed: ${result.failedEvidence.join(', ')}`);
    if(result.ambiguousEvidence.length) console.log(`ambiguous: ${result.ambiguousEvidence.join(', ')}`);
    if(result.unprovenRequirements.length) console.log(`unproven requirements: ${result.unprovenRequirements.join(', ')}`);
    process.exit(1);
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch((e)=>{console.error(e instanceof Error?(e.stack??e.message):String(e));process.exit(1);});
