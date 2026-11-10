import { describe, expect, it } from 'vitest';
import {
  effectiveParticipationState,
  planParticipationCommand,
} from '../../packages/domain/src/participants.js';

const deadline = new Date('2026-11-09T12:00:00.000Z');
const before = new Date('2026-11-09T11:59:59.999Z');
const exact = new Date('2026-11-09T12:00:00.000Z');

describe('Slice 4 participation lifecycle', () => {
  it('treats exact TTL boundary as expired', () => {
    expect(effectiveParticipationState('PENDING', deadline, before)).toBe('PENDING');
    expect(effectiveParticipationState('PENDING', deadline, exact)).toBe('EXPIRED');
    expect(effectiveParticipationState('ACTIVE', deadline, exact)).toBe('ACTIVE');
  });

  it('accepts only live PENDING and converges repeated ACTIVE', () => {
    expect(planParticipationCommand('PENDING','ACCEPT',deadline,before)).toEqual({
      action:'TRANSITION', from:'PENDING', to:'ACTIVE',
    });
    expect(planParticipationCommand('ACTIVE','ACCEPT',deadline,before)).toEqual({
      action:'CONVERGED', state:'ACTIVE',
    });
    for (const state of ['DECLINED','EXPIRED','WITHDRAWN'] as const) {
      expect(planParticipationCommand(state,'ACCEPT',deadline,before)).toEqual({
        action:'CONFLICT', currentState:state,
      });
    }
  });

  it('decline is PENDING→DECLINED and repeated decline converges', () => {
    expect(planParticipationCommand('PENDING','DECLINE',deadline,before)).toEqual({
      action:'TRANSITION', from:'PENDING', to:'DECLINED',
    });
    expect(planParticipationCommand('DECLINED','DECLINE',deadline,before)).toEqual({
      action:'CONVERGED', state:'DECLINED',
    });
  });

  it('withdraw is ACTIVE→WITHDRAWN and never substitutes for decline', () => {
    expect(planParticipationCommand('ACTIVE','WITHDRAW',deadline,before)).toEqual({
      action:'TRANSITION', from:'ACTIVE', to:'WITHDRAWN',
    });
    expect(planParticipationCommand('WITHDRAWN','WITHDRAW',deadline,before)).toEqual({
      action:'CONVERGED', state:'WITHDRAWN',
    });
    expect(planParticipationCommand('PENDING','WITHDRAW',deadline,before)).toEqual({
      action:'CONFLICT', currentState:'PENDING',
    });
  });

  it('a due PENDING command materializes EXPIRED before conflict', () => {
    for (const command of ['ACCEPT','DECLINE','WITHDRAW'] as const) {
      expect(planParticipationCommand('PENDING',command,deadline,exact)).toEqual({
        action:'EXPIRE_AND_CONFLICT', currentState:'EXPIRED',
      });
    }
  });
});
