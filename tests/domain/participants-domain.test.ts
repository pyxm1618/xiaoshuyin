import { describe, expect, it } from 'vitest';
import {
  effectiveParticipationState,
  planParticipationCommand,
} from '../../packages/domain/src/participants.js';

const expires = new Date('2026-11-09T12:00:00.000Z');
const before = new Date('2026-11-09T11:59:59.999Z');
const at = new Date('2026-11-09T12:00:00.000Z');

describe('Slice 4 participant lifecycle domain', () => {
  it('PENDING has no active capability and becomes effectively EXPIRED at the exact DB deadline', () => {
    expect(effectiveParticipationState('PENDING', expires, before)).toBe('PENDING');
    expect(effectiveParticipationState('PENDING', expires, at)).toBe('EXPIRED');
    expect(effectiveParticipationState('ACTIVE', expires, at)).toBe('ACTIVE');
  });

  it('accept / decline / withdraw expose only the frozen legal transitions', () => {
    expect(planParticipationCommand('PENDING','ACCEPT',expires,before)).toEqual({
      action:'TRANSITION',from:'PENDING',to:'ACTIVE',
    });
    expect(planParticipationCommand('PENDING','DECLINE',expires,before)).toEqual({
      action:'TRANSITION',from:'PENDING',to:'DECLINED',
    });
    expect(planParticipationCommand('ACTIVE','WITHDRAW',expires,before)).toEqual({
      action:'TRANSITION',from:'ACTIVE',to:'WITHDRAWN',
    });
  });

  it('same terminal command converges but terminal states never reactivate', () => {
    expect(planParticipationCommand('ACTIVE','ACCEPT',expires,before)).toEqual({
      action:'CONVERGED',state:'ACTIVE',
    });
    expect(planParticipationCommand('DECLINED','DECLINE',expires,before)).toEqual({
      action:'CONVERGED',state:'DECLINED',
    });
    expect(planParticipationCommand('WITHDRAWN','WITHDRAW',expires,before)).toEqual({
      action:'CONVERGED',state:'WITHDRAWN',
    });
    for (const state of ['DECLINED','EXPIRED','WITHDRAWN'] as const) {
      expect(planParticipationCommand(state,'ACCEPT',expires,before)).toEqual({
        action:'CONFLICT',currentState:state,
      });
    }
  });

  it('due PENDING commands materialize expiry before any transition', () => {
    for (const command of ['ACCEPT','DECLINE','WITHDRAW'] as const) {
      expect(planParticipationCommand('PENDING',command,expires,at)).toEqual({
        action:'EXPIRE_AND_CONFLICT',currentState:'EXPIRED',
      });
    }
  });

  it('withdraw never substitutes for decline', () => {
    expect(planParticipationCommand('PENDING','WITHDRAW',expires,before)).toEqual({
      action:'CONFLICT',currentState:'PENDING',
    });
    expect(planParticipationCommand('DECLINED','WITHDRAW',expires,before)).toEqual({
      action:'CONFLICT',currentState:'DECLINED',
    });
  });
});
