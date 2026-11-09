import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  acceptInvite,
  buildParticipationApp,
  createParticipationFixture,
  declineParticipation,
  invite,
  withdrawParticipation,
} from '../setup/participation.js';

describe('Slice 4 participation has no Evidence side effects', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;

  beforeAll(async () => { h=await buildParticipationApp(); });
  afterAll(async () => { await h.close(); });

  async function evidenceState() {
    const regs=await h.admin.query(
      `SELECT to_regclass('public.assertions')::text AS assertions,
              to_regclass('public.observations')::text AS observations`
    );
    const row=regs.rows[0];
    if (!row.assertions || !row.observations) {
      return {present:false as const,assertions:0,observations:0};
    }
    const counts=await h.admin.query(
      `SELECT
        (SELECT count(*)::int FROM assertions) AS assertions,
        (SELECT count(*)::int FROM observations) AS observations`
    );
    return {present:true as const,...counts.rows[0]};
  }

  it('accept, decline and withdraw leave assertions/observations unchanged', async () => {
    const before=await evidenceState();

    // ACCEPT + WITHDRAW path.
    const a=await createParticipationFixture(h,'evidence-aw',{target:'manager'});
    const ai=await invite(h.app,a.manager.token,a.caseId,a.manager.personId,'evidence-aw-invite');
    expect(ai.statusCode).toBe(201);
    const accepted=await acceptInvite(h.app,a.manager.token,ai.json().inviteToken,'evidence-aw-accept');
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().state).toBe('ACTIVE');
    const withdrawn=await withdrawParticipation(
      h.app,a.manager.token,ai.json().participationId,'evidence-aw-withdraw'
    );
    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json().state).toBe('WITHDRAWN');

    // DECLINE path.
    const d=await createParticipationFixture(h,'evidence-d',{target:'manager'});
    const di=await invite(h.app,d.manager.token,d.caseId,d.manager.personId,'evidence-d-invite');
    expect(di.statusCode).toBe(201);
    const declined=await declineParticipation(
      h.app,d.manager.token,di.json().participationId,'evidence-d-decline'
    );
    expect(declined.statusCode).toBe(200);
    expect(declined.json().state).toBe('DECLINED');

    const after=await evidenceState();
    expect(after.present).toBe(before.present);
    expect(after.assertions).toBe(before.assertions);
    expect(after.observations).toBe(before.observations);
  });

  it('Slice 4 production files contain no Evidence writer', () => {
    for (const path of [
      'packages/domain/src/participants.ts',
      'apps/server/api/src/routes/participations.ts',
      'db/migrations/005_case_participant_core.sql',
    ]) {
      const source=readFileSync(join(process.cwd(),path),'utf8');
      expect(source).not.toMatch(/\bINSERT\s+INTO\s+(assertions|observations)\b/i);
      expect(source).not.toMatch(/\bUPDATE\s+(assertions|observations)\b/i);
      expect(source).not.toMatch(/\bDELETE\s+FROM\s+(assertions|observations)\b/i);
    }
  });
});
