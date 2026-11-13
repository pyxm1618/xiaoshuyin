import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  recordPurposeScopedConsentDecision,
  getCurrentPurposeScopedConsentDecision,
  insertSceneArtifact,
  getLatestSceneArtifact,
} = vi.hoisted(() => ({
  recordPurposeScopedConsentDecision: vi.fn(),
  getCurrentPurposeScopedConsentDecision: vi.fn(),
  insertSceneArtifact: vi.fn(),
  getLatestSceneArtifact: vi.fn(),
}));

vi.mock('@xiaoshuyin/compliance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/compliance')>();
  return {
    ...actual,
    recordPurposeScopedConsentDecision,
    getCurrentPurposeScopedConsentDecision,
  };
});

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return { ...actual, insertSceneArtifact, getLatestSceneArtifact };
});

import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
} from '@xiaoshuyin/compliance';
import { applyDigitalUseNodeSemantics } from '../../apps/server/api/src/services/digital-use-node-semantics.js';

function ctx(nodeCode: string, response: Record<string, unknown>) {
  return {
    tx: {} as never,
    actor: {
      accountId: '00000000-0000-7000-8000-000000000001',
      personId: '00000000-0000-7000-8000-000000000002',
    },
    familyId: '00000000-0000-7000-8000-000000000003',
    caseId: '00000000-0000-7000-8000-000000000004',
    nodeCode,
    response,
    currentInputRefs: [] as const,
    requestEvidence: {
      clientIp: '127.0.0.1',
      userAgent: 'slice12-test',
      pepper: '0123456789abcdef0123456789abcdef',
    },
  };
}

const CONFIRMATION_HASH = 'b'.repeat(64);

describe('T1212 01004 Consent / 01000 no-invention', () => {
  beforeEach(() => {
    recordPurposeScopedConsentDecision.mockReset();
    getCurrentPurposeScopedConsentDecision.mockReset();
    insertSceneArtifact.mockReset();
    getLatestSceneArtifact.mockReset();
    recordPurposeScopedConsentDecision.mockResolvedValue({
      consentRecordId: '00000000-0000-7000-8000-000000000050',
      purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      caseId: '00000000-0000-7000-8000-000000000004',
      decisionActorPersonId: '00000000-0000-7000-8000-000000000002',
      decision: 'GRANTED',
      version: 1,
      decidedAt: '2026-11-13T00:00:00.000Z',
      supersedesId: null,
      replayed: false,
    });
    getCurrentPurposeScopedConsentDecision.mockResolvedValue({
      consentRecordId: '00000000-0000-7000-8000-000000000050',
      purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      caseId: '00000000-0000-7000-8000-000000000004',
      decisionActorPersonId: '00000000-0000-7000-8000-000000000002',
      decision: 'GRANTED',
      version: 1,
      decidedAt: '2026-11-13T00:00:00.000Z',
      supersedesId: null,
    });
    getLatestSceneArtifact.mockResolvedValue(null);
    insertSceneArtifact.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000060',
      revision: 1,
    });
  });

  it('explicitly injects the PR #35 approved disclosure authority into the one Consent owner', async () => {
    const result = await applyDigitalUseNodeSemantics(ctx('01004', { decision: 'GRANTED', confirmationStatementHash: CONFIRMATION_HASH }));
    expect(result.conditions).toEqual({
      CONSENT_ACCEPTED: true,
      CONSENT_DECLINED: false,
    });
    expect(result.outputRefs).toEqual([
      { type: 'CONSENT', id: '00000000-0000-7000-8000-000000000050' },
    ]);

    expect(recordPurposeScopedConsentDecision).toHaveBeenCalledTimes(1);
    const [tx, input, authority] = recordPurposeScopedConsentDecision.mock.calls[0]!;
    expect(tx).toBeDefined();
    expect(authority).toBe(APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY);
    expect(input.disclosure).toEqual({
      reference: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.reference,
      version: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.version,
      hash: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.hash,
    });
    expect(input.purpose).toBe('DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT');
    expect(input.sceneAuthorization).toEqual({ nodeCode: '01004', verified: true });
    expect(input.confirmationStatementHash).toBe(CONFIRMATION_HASH);
  });

  it('records explicit decline through Consent owner and routes only to decline terminal', async () => {
    recordPurposeScopedConsentDecision.mockResolvedValueOnce({
      consentRecordId: '00000000-0000-7000-8000-000000000051',
      decision: 'DECLINED',
    });
    const result = await applyDigitalUseNodeSemantics(ctx('01004', { decision: 'DECLINED', confirmationStatementHash: CONFIRMATION_HASH }));
    expect(result.conditions).toEqual({
      CONSENT_ACCEPTED: false,
      CONSENT_DECLINED: true,
    });
    expect(result.nextInputRefs).toEqual([
      { type: 'CONSENT', id: '00000000-0000-7000-8000-000000000051' },
    ]);
  });

  it('fails closed when server request evidence is unavailable', async () => {
    const input = ctx('01004', { decision: 'GRANTED', confirmationStatementHash: CONFIRMATION_HASH });
    const { requestEvidence: _requestEvidence, ...withoutEvidence } = input;
    await expect(applyDigitalUseNodeSemantics(withoutEvidence))
      .rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(recordPurposeScopedConsentDecision).not.toHaveBeenCalled();
  });

  it('01000 persists only the approved category boundary and truthful unavailable state', async () => {
    const input = ctx('01000', { category: 'EMOTION' });
    input.currentInputRefs = [
      { type: 'CONSENT', id: '00000000-0000-7000-8000-000000000050' },
    ] as never;

    const result = await applyDigitalUseNodeSemantics(input);
    expect(getCurrentPurposeScopedConsentDecision).toHaveBeenCalledWith(
      input.tx,
      {
        familyId: input.familyId,
        caseId: input.caseId,
        actor: input.actor,
        purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      }
    );
    expect(result.conditions).toEqual({});
    expect(result.progression).toBe('HOLD');
    expect(result.holdReasonCode).toBe('APPROVED_INSTRUMENT_UNAVAILABLE');
    expect(insertSceneArtifact).toHaveBeenCalledTimes(1);

    const artifactInput = insertSceneArtifact.mock.calls[0]![1];
    expect(artifactInput.artifactType).toBe('SUPPLEMENTAL_ASSESSMENT_BOUNDARY');
    expect(artifactInput.sourceNodeCode).toBe('01000');
    expect(artifactInput.data).toEqual({
      category: 'EMOTION',
      status: 'APPROVED_INSTRUMENT_UNAVAILABLE',
      approvedInstrument: null,
      questionnaire: null,
      scoring: null,
      cutoff: null,
      diagnosis: null,
      generated: false,
    });
    expect(JSON.stringify(artifactInput.data)).not.toMatch(/question\s*bank|cut[-_ ]?off\s*value/i);
  });

  it('fails closed if current Consent truth is revoked or does not match the routed ref', async () => {
    const input = ctx('01000', { category: 'PARENT_CHILD_INTERACTION' });
    input.currentInputRefs = [
      { type: 'CONSENT', id: '00000000-0000-7000-8000-000000000050' },
    ] as never;
    getCurrentPurposeScopedConsentDecision.mockResolvedValueOnce({
      consentRecordId: '00000000-0000-7000-8000-000000000050',
      decision: 'REVOKED',
    });
    await expect(applyDigitalUseNodeSemantics(input))
      .rejects.toMatchObject({ code: 'SUPPLEMENTAL_ASSESSMENT_CONSENT_REQUIRED' });
    expect(insertSceneArtifact).not.toHaveBeenCalled();
  });

  it('appends a superseding unavailable artifact on a new legal retry', async () => {
    const input = ctx('01000', { category: 'EMOTION' });
    input.currentInputRefs = [
      { type: 'CONSENT', id: '00000000-0000-7000-8000-000000000050' },
    ] as never;
    getLatestSceneArtifact.mockResolvedValueOnce({
      id: '00000000-0000-7000-8000-000000000059',
      revision: 3,
    });
    await applyDigitalUseNodeSemantics(input);
    expect(insertSceneArtifact.mock.calls[0]![1]).toMatchObject({
      revision: 4,
      supersedesId: '00000000-0000-7000-8000-000000000059',
    });
  });

  it('allows only the two approved supplemental categories', async () => {
    await expect(applyDigitalUseNodeSemantics(ctx('01000', {
      category: 'UNAPPROVED_DIAGNOSTIC_SCALE',
    }))).rejects.toMatchObject({ code: 'SCENE_RESPONSE_INVALID' });
    expect(insertSceneArtifact).not.toHaveBeenCalled();
  });
});
