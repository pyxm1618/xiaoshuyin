import { describe, expect, it } from 'vitest';
import {
  buildA200401RecordMarker,
  buildA2010DownstreamBoundary,
  buildSolutionSummaryArtifactData,
  buildTimelineArtifactData,
  initialA1001Projection,
  resolveDigitalUseRuntimeNode,
} from '@xiaoshuyin/scenes/digital-use';

describe('T1206 Scene runtime pure primitives', () => {
  it('consumes the Slice 11 manifest and never promotes A200401 to a node', () => {
    expect(resolveDigitalUseRuntimeNode('A1001').nodeCode).toBe('A1001');
    expect(() => resolveDigitalUseRuntimeNode('A200401')).toThrow('SCENE_NODE_NOT_FOUND');
    expect(initialA1001Projection()).toMatchObject({
      scenePackageVersion:'v1', nodeCode:'A1001', status:'AVAILABLE', revision:1,
    });
  });

  it('builds A200401 only as a record marker backed by Evidence refs', () => {
    expect(buildA200401RecordMarker([
      {type:'OBSERVATION',id:'00000000-0000-7000-8000-000000000001'},
    ])).toEqual({
      type:'RECORD_MARKER',
      markerCode:'A200401',
      evidenceRefs:[{type:'OBSERVATION',id:'00000000-0000-7000-8000-000000000001'}],
    });
    expect(() => buildA200401RecordMarker([])).toThrow('SCENE_RESPONSE_INVALID');
  });

  it('builds timeline artifact data without scheduler or delivery truth', () => {
    const data=buildTimelineArtifactData({chosenDate:'2026-12-01'});
    expect(data).toMatchObject({
      timeline:{chosenDate:'2026-12-01'},
      followUpBasis:{
        kind:'DRAFT_ONLY',
        schedulerCreated:false,
        notificationScheduled:false,
        notificationDelivered:false,
      },
    });
  });

  it('builds A2010 summary with truthful downstream-unavailable boundary', () => {
    const data=buildSolutionSummaryArtifactData({
      timelineArtifactId:'artifact-1',
      timelineData:{chosenDate:'2026-12-01'},
    });
    expect(data).toMatchObject({
      activation:{activePlan:false,interventionActive:false,executionActive:false},
      downstream:{
        routeIntent:'A3000', available:false,
        reasonCode:'DOWNSTREAM_RUNTIME_UNAVAILABLE',
      },
    });
    expect(buildA2010DownstreamBoundary().available).toBe(false);
  });
});
