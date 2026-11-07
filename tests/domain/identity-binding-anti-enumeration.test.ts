import { describe, it, expect } from 'vitest';
import {
  candidateBootstrapReusedResponse,
  candidateBootstrapResponse,
  candidateDecisionResponse,
  candidateSessionResponse,
  candidateStatusResponse,
} from '../../packages/domain/src/identity-binding-anti-enumeration.js';

describe('candidate anti-enumeration serializers', () => {
  it('bootstrap generic body has exactly binding + pendingContextToken', () => {
    const body = candidateBootstrapResponse('token');
    expect(Object.keys(body)).toEqual(['binding', 'pendingContextToken']);
    expect(body.binding).toBe('NOT_COMPLETED');
  });

  it('no internal reason / attempt / person / family key ever leaks', () => {
    const bodies = [
      candidateBootstrapResponse('t'),
      candidateDecisionResponse(),
      candidateStatusResponse(false),
      candidateSessionResponse(false),
    ];
    for (const body of bodies) {
      const text = JSON.stringify(body).toLowerCase();
      for (const forbidden of [
        'attemptid',
        'personid',
        'familyid',
        'ageband',
        'guardian',
        'consent',
        'reason',
        'terminal',
        'invalid',
      ]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it('decision / status / session generic share the same key set', () => {
    expect(Object.keys(candidateDecisionResponse())).toEqual(['binding']);
    expect(Object.keys(candidateStatusResponse(false))).toEqual(['binding']);
    expect(Object.keys(candidateSessionResponse(false))).toEqual(['binding']);
    expect(candidateStatusResponse(false).binding).toBe('NOT_COMPLETED');
  });

  it('Case B reuse and COMMITTED session are the only distinguishable successes', () => {
    const reused = candidateBootstrapReusedResponse({
      sessionToken: 's',
      accountId: 'a',
      personId: 'p',
    });
    expect(reused).toEqual({
      binding: 'REUSED',
      sessionToken: 's',
      account: { id: 'a' },
      person: { id: 'p' },
    });
    expect(candidateStatusResponse(true)).toEqual({ binding: 'COMMITTED' });
  });
});