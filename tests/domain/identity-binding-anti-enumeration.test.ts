import { describe, it, expect } from 'vitest';
import {
  candidateAffirmResponse,
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

  it('AFFIRM valid and decoy challenges share the exact external shape', () => {
    const valid = candidateAffirmResponse('a'.repeat(192));
    const decoy = candidateAffirmResponse('b'.repeat(192));
    expect(Object.keys(valid)).toEqual(['binding', 'pairingChallenge']);
    expect(Object.keys(decoy)).toEqual(['binding', 'pairingChallenge']);
    expect(valid.binding).toBe('NOT_COMPLETED');
    expect(decoy.binding).toBe('NOT_COMPLETED');
    expect(valid.pairingChallenge).toHaveLength(192);
    expect(decoy.pairingChallenge).toHaveLength(192);
    expect(valid.pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
    expect(decoy.pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
    expect(valid).not.toHaveProperty('expiresAt');
    expect(decoy).not.toHaveProperty('expiresAt');
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