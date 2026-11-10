import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addBoundAdultNonManagerToFamily,
  buildParticipationApp,
  createParticipationFixture,
  getParticipation,
  invite,
} from '../setup/participation.js';

describe('Slice 4 scope boundary', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('adds no generic participation RBAC / visibility matrix / response system', () => {
    const source=[
      readFileSync(join(process.cwd(),'packages/domain/src/participants.ts'),'utf8'),
      readFileSync(join(process.cwd(),'apps/server/api/src/routes/participations.ts'),'utf8'),
      readFileSync(join(process.cwd(),'db/migrations/005_case_participant_core.sql'),'utf8'),
    ].join('\n');

    for(const forbidden of [
      'authorizeParticipation',
      'participant_role',
      'participation_role',
      'visibility_matrix',
      'participant_responses',
      'participation_responses',
      'CASE_VIEWED',
      'CASE_LISTED',
    ]){
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('ACTIVE participation does not grant Case-wide business object access', async () => {
    const f=await createParticipationFixture(h,'scope-active',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'scope-active');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'scope-active-invite');
    expect(created.statusCode).toBe(201);

    // Before acceptance, the target may read only the participation resource.
    const participation=await getParticipation(
      h.app,target.token,created.json().participationId
    );
    expect(participation.statusCode).toBe(200);

    // The target is not Case manager; Case detail stays fail-closed even though
    // Family membership/RLS can make the Case row technically visible.
    const caseRead=await h.app.inject({
      method:'GET',
      url:`/api/v1/cases/${f.caseId}`,
      headers:{authorization:`Bearer ${target.token}`},
    });
    expect(caseRead.statusCode).toBe(404);
    expect(caseRead.json()).toEqual({
      code:'CASE_NOT_FOUND',
      message:'Case not found',
    });
    expect(JSON.stringify(caseRead.json())).not.toContain(f.caseId);
  });
});
