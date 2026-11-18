import { readFileSync } from 'node:fs';
import {
  acceptInvite,
  addBoundAdultNonManagerToFamily,
  addBoundAdultTargetToFamily,
  buildParticipationApp,
  createParticipationFixture,
  declineParticipation,
  getParticipation,
  invite,
  lookupInvite,
  withdrawParticipation,
} from '../setup/participation.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Slice 4 participation authorization', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('Family manager can read a target participation; ordinary member cannot use manager authority', async () => {
    const f=await createParticipationFixture(h,'auth-manager',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'auth-target');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'auth-manager-invite');
    expect(created.statusCode).toBe(201);

    const managerRead=await getParticipation(h.app,f.manager.token,created.json().participationId);
    expect(managerRead.statusCode).toBe(200);

    const nonManagerCreate=await invite(
      h.app,target.token,f.caseId,f.manager.personId,'auth-non-manager-invite'
    );
    expect(nonManagerCreate.statusCode).toBe(404);
    expect(nonManagerCreate.json().code).toBe('CASE_NOT_FOUND');
  });

  it('family RLS visibility does not replace self authorization', async () => {
    const f=await createParticipationFixture(h,'auth-self',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'auth-self-target');
    const other=await addBoundAdultNonManagerToFamily(h,f.familyId,'auth-self-other');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'auth-self-invite');
    expect(created.statusCode).toBe(201);

    const targetRead=await getParticipation(h.app,target.token,created.json().participationId);
    expect(targetRead.statusCode).toBe(200);
    const otherRead=await getParticipation(h.app,other.token,created.json().participationId);
    expect(otherRead.statusCode).toBe(404);
    expect(otherRead.json().code).toBe('PARTICIPATION_NOT_FOUND');
  });
});

describe('Phase 2 participant age/consent authority projection', () => {
  const spec = readFileSync(new URL('../../specs/004-case-participant-core/spec.md', import.meta.url), 'utf8');

  it('keeps caller age input non-authoritative and consent purpose scoped', () => {
    expect(spec).toContain('FR-032 [Phase2-D4/D5]');
    expect(spec).toContain('FR-033 [Phase2-D5]');
    expect(spec).toContain('FR-034 [Phase2-D5]');
    expect(spec).toContain('FR-035 [Phase2-D5]');
    expect(spec).toContain('MUST NOT be treated as blanket authority');
  });

  it('projects the registered invitation lifecycle without an unauthorized terminal state', () => {
    expect(spec).toContain('V1 Technical Authority owns the invitation / participation lifecycle semantics');
    expect(spec).toContain('PENDING → ACTIVE / DECLINED / EXPIRED；ACTIVE → WITHDRAWN');
    expect(spec).toContain('invitation remains unchanged unless an authorized invitation lifecycle event occurs');
    expect(spec).not.toContain('越权作废');
    expect(spec).toContain('不得创造 REVOKED / CANCELLED / unauthorized-void / manager-cancel 终态');
    expect(spec).not.toContain('Slice 4 继续持有 participation resource 生命周期');
  });
});
