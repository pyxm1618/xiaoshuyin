import { describe, expect, it } from 'vitest';
import {
  casCompleteSceneNodeState,
  getSceneNodeState,
  resolveSceneArtifactRefCurrentness,
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

  it('resolves exact Scene Artifact currentness without hiding supersession state', async () => {
    const tx = txWith((_text, values) => {
      const id = values[0];
      if (id === 'artifact-current') {
        return [{ id, revision: 3, successor_id: null }];
      }
      if (id === 'artifact-old') {
        return [{ id, revision: 2, successor_id: 'artifact-current' }];
      }
      return [];
    });

    expect(
      await resolveSceneArtifactRefCurrentness(tx, {
        artifactId: 'artifact-current',
        familyId: 'family-1',
        caseId: 'case-1',
      })
    ).toEqual({
      status: 'CURRENT',
      artifactId: 'artifact-current',
      revision: 3,
    });

    expect(
      await resolveSceneArtifactRefCurrentness(tx, {
        artifactId: 'artifact-old',
        familyId: 'family-1',
        caseId: 'case-1',
      })
    ).toEqual({
      status: 'SUPERSEDED',
      artifactId: 'artifact-old',
      revision: 2,
      successorId: 'artifact-current',
    });

    expect(
      await resolveSceneArtifactRefCurrentness(tx, {
        artifactId: 'artifact-missing',
        familyId: 'family-1',
        caseId: 'case-1',
      })
    ).toEqual({ status: 'MISSING_OR_OUT_OF_SCOPE' });
  });

  it('derives exact-ref currentness only from scoped supersession, never created_at or a lock', async () => {
    let capturedText = '';
    let capturedValues: unknown[] = [];
    const tx = txWith((text, values) => {
      capturedText = text;
      capturedValues = values;
      return [{ id: values[0], revision: 1, successor_id: null }];
    });

    await resolveSceneArtifactRefCurrentness(tx, {
      artifactId: 'artifact-1',
      familyId: 'family-1',
      caseId: 'case-1',
    });

    expect(capturedValues).toEqual(['artifact-1', 'family-1', 'case-1']);
    expect(capturedText).toContain('successor.supersedes_id = artifact.id');
    expect(capturedText).toContain('artifact.family_id = $2');
    expect(capturedText).toContain('artifact.case_id = $3');
    expect(capturedText).not.toContain('created_at');
    expect(capturedText).not.toMatch(/ORDER BY/i);
    expect(capturedText).not.toContain('FOR UPDATE');
  });

});
