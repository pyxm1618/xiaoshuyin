import { describe, expect, it } from 'vitest';
import { loadRegistry, loadTraceability, reconcileExecution, validateRegistry } from '../scripts/professional-knowledge-semantic-evidence.mjs';

function clone<T>(value:T):T { return JSON.parse(JSON.stringify(value)) as T; }
function allPassed(registry:ReturnType<typeof loadRegistry>) {
  const byFile=new Map<string,any[]>();
  for(const ev of registry.evidence){ const a=byFile.get(ev.file)??[]; a.push({title:ev.test,fullName:`semantic suite > ${ev.test}`,status:'passed'}); byFile.set(ev.file,a); }
  return {testResults:[...byFile.entries()].map(([file,assertionResults])=>({name:`/repo/${file}`,assertionResults}))};
}
function assertion(execution:any,ev:any){ const f=execution.testResults.find((x:any)=>x.name.endsWith(ev.file)); return f.assertionResults.find((x:any)=>x.title===ev.test); }
function remove(execution:any,ev:any){ const f=execution.testResults.find((x:any)=>x.name.endsWith(ev.file)); f.assertionResults=f.assertionResults.filter((x:any)=>x.title!==ev.test); }

describe('Slice 17 semantic evidence gate fail-closed mechanics',()=>{
  it('accepts only when all 126 requirements resolve to runner-PASS evidence',()=>{
    const r=loadRegistry(); const x=reconcileExecution(r,allPassed(r),loadTraceability());
    expect(x.ok).toBe(true); expect(x.provenRequirements).toHaveLength(126);
  });
  it('fails when a mapped test is removed or evidence did not execute',()=>{
    const r=loadRegistry(),e=allPassed(r); remove(e,r.evidence[0]); const x=reconcileExecution(r,e,loadTraceability());
    expect(x.ok).toBe(false); expect(x.unexecutedEvidence).toContain(r.evidence[0].evidenceId); expect(x.unprovenRequirements.length).toBeGreaterThan(0);
  });
  it('fails for skipped, todo, or disabled runner status',()=>{
    const r=loadRegistry();
    for(const s of ['pending','skipped','todo','disabled']){ const e=allPassed(r); assertion(e,r.evidence[0]).status=s; const x=reconcileExecution(r,e,loadTraceability()); expect(x.ok,s).toBe(false); expect(x.skippedTodoEvidence,s).toContain(r.evidence[0].evidenceId); }
  });
  it('fails when an evidence identity is disabled in the registry',()=>{
    const r=clone(loadRegistry()); r.evidence[0].enabled=false; const x=validateRegistry(r,loadTraceability());
    expect(x.ok).toBe(false); expect(x.errors.disabledEvidence).toContain(r.evidence[0].evidenceId);
  });
  it('fails when a mapped Evidence ID is removed from the registry',()=>{
    const r=clone(loadRegistry()); const removed=r.evidence.shift(); const x=validateRegistry(r,loadTraceability());
    expect(x.ok).toBe(false); expect(x.errors.unknownEvidence.some((v:string)=>v.endsWith(removed.evidenceId))).toBe(true);
  });
  it('fails when evidence execution reports failure',()=>{
    const r=loadRegistry(),e=allPassed(r); assertion(e,r.evidence[0]).status='failed'; const x=reconcileExecution(r,e,loadTraceability());
    expect(x.ok).toBe(false); expect(x.failedEvidence).toContain(r.evidence[0].evidenceId);
  });
  it('fails when a requirement points to a nonexistent Evidence ID',()=>{
    const r=clone(loadRegistry()); r.requirements[0].evidenceIds.push('S17-EVID-DOES-NOT-EXIST'); const x=validateRegistry(r,loadTraceability());
    expect(x.ok).toBe(false); expect(x.errors.unknownEvidence).toContain(`${r.requirements[0].requirementId}:S17-EVID-DOES-NOT-EXIST`);
  });
  it('fails on duplicate/unknown requirement IDs and orphan evidence',()=>{
    const d=clone(loadRegistry()); d.requirements.push(clone(d.requirements[0])); expect(validateRegistry(d,loadTraceability()).errors.duplicateRequirements).toContain(d.requirements[0].requirementId);
    const u=clone(loadRegistry()); u.requirements.push({requirementId:'FR-999',taskIds:[],evidenceIds:[]}); expect(validateRegistry(u,loadTraceability()).errors.unknownRequirements).toContain('FR-999');
    const o=clone(loadRegistry()); o.evidence.push({evidenceId:'S17-EVID-ORPHAN',task:'AUDIT2',type:'EXECUTABLE',proofMode:'RUNNER_RESULT',file:'tests/professional-knowledge-audit2-remediation.integration.test.ts',test:'orphan synthetic identity',contract:'must be rejected as orphan',enabled:true}); expect(validateRegistry(o,loadTraceability()).errors.orphanEvidence).toContain('S17-EVID-ORPHAN');
  });
});
