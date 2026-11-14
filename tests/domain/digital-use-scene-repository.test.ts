import { describe, expect, it } from 'vitest';
import {
  casCompleteSceneNodeState,
  getSceneNodeState,
  validateSceneRefs,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';

function txWith(handler: (text: string, values: unknown[]) => unknown[]) {
  return {
    query: async (text: string, values: unknown[]) => ({ rows: handler(text, values) }),
  } as any;
}

describe('T1205 Scene repository primitives', () => {
  it('reads one exact node and optionally locks it without routing', async () => {
    const queries: string[] = [];
    const tx = txWith((text) => {
      queries.push(text);
      return [];
    });
    expect(await getSceneNodeState(tx,'case-1','A1001',true)).toBeNull();
    expect(queries[0]).toContain('case_id = $1 AND node_code = $2');
    expect(queries[0]).toContain('FOR UPDATE');
    expect(queries[0]).not.toContain('allowedNext');
  });

  it('uses revision + package + legal current status as the CAS fence', async () => {
    let captured='';
    const tx=txWith((text)=>{ captured=text; return []; });
    const result=await casCompleteSceneNodeState(tx,{
      caseId:'case-1', nodeCode:'A1001', scenePackageVersion:'v1',
      expectedRevision:3, status:'COMPLETED', branchReasonCodes:[],
      inputRefs:[], outputRefs:[],
    });
    expect(result).toBeNull();
    expect(captured).toContain('scene_package_version = $3');
    expect(captured).toContain('revision = $4');
    expect(captured).toContain("status IN ('AVAILABLE','IN_PROGRESS')");
    expect(captured).toContain('revision = revision + 1');
  });

  it('rejects a cross-Case Evidence ref and validates A200401 marker through its Evidence refs', async () => {
    const tx=txWith((_text,values)=>{
      const id=values[0];
      return id==='same-case-ref' ? [{ok:true}] : [];
    });
    const cross: StoredSceneRef[]=[{type:'ASSERTION',id:'other-case-ref'}];
    expect(await validateSceneRefs(tx,{familyId:'f',caseId:'c',refs:cross})).toBe(false);

    const marker: StoredSceneRef[]=[{
      type:'RECORD_MARKER', markerCode:'A200401',
      evidenceRefs:[{type:'OBSERVATION',id:'same-case-ref'}],
    }];
    expect(await validateSceneRefs(tx,{familyId:'f',caseId:'c',refs:marker})).toBe(true);
  });
});
