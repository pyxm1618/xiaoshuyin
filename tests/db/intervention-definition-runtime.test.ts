import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import pg from 'pg';
import {
  createInterventionDefinitionCandidate,
  createInterventionDefinitionSuccessor,
  retireInterventionDefinition,
} from '../../apps/server/api/src/services/intervention-definitions.js';
import { interventionDefinitionContentHash } from '../../packages/domain/src/index.js';
import { createAdminPool } from '../setup/db.js';
import {
  TEST_ONLY_QUALIFICATION_PROVIDER,
  interventionSemantic,
} from '../support/intervention.js';

describe('Slice 16 InterventionDefinition DB runtime', () => {
  let admin: pg.Pool;
  let appPool: pg.Pool;
  let accountId: string;
  let personId: string;
  const prefix = 's16rt_' + crypto.randomUUID();
  const key = (label: string) => 's16-runtime-' + label + '-' + crypto.randomUUID();

  beforeAll(async () => {
    admin = createAdminPool();
    appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    const account = await admin.query<{ id: string }>(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      [prefix]
    );
    accountId = account.rows[0]!.id;
    const person = await admin.query<{ id: string }>(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id',
      [accountId]
    );
    personId = person.rows[0]!.id;
    await admin.query(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
      [accountId, personId]
    );
  });

  afterAll(async () => {
    await admin.query('DELETE FROM business_audit_events WHERE actor_account_id=$1', [accountId]).catch(() => undefined);
    await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id=$1', [accountId]).catch(() => undefined);
    await admin.query('DELETE FROM intervention_definitions WHERE created_by_person_id=$1', [personId]).catch(() => undefined);
    await admin.query('DELETE FROM staff_assignments WHERE account_id=$1', [accountId]).catch(() => undefined);
    await admin.query('DELETE FROM persons WHERE id=$1', [personId]).catch(() => undefined);
    await admin.query('DELETE FROM accounts WHERE id=$1', [accountId]).catch(() => undefined);
    await appPool.end();
    await admin.end();
  });

  const actor = () => ({ accountId, personId });

  it('is FORCE-RLS, has bounded privileges and no Approval/qualification owner columns', async () => {
    const relation = await admin.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      owner: string;
    }>(
      "SELECT relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) AS owner " +
        "FROM pg_class WHERE oid='intervention_definitions'::regclass"
    );
    expect(relation.rows[0]).toMatchObject({
      relrowsecurity: true,
      relforcerowsecurity: true,
      owner: 'xiaoshuyin_migrator',
    });

    const columns = await admin.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns " +
        "WHERE table_schema='public' AND table_name='intervention_definitions'"
    );
    const names = columns.rows.map((row) => row.column_name);
    for (const required of [
      'id','scene_id','intervention_code','version','content_hash','revision',
      'target_problem_or_mechanism','formulation_dependencies',
      'supporting_evidence_requirements','applicable_conditions',
      'exclusion_or_contraindication_conditions','age_and_development_scope',
      'rationale','intervention_steps','participation_and_consent_requirements',
      'baseline_and_observation','expected_observable_change','burden_and_barriers',
      'adverse_or_worsening_signals','review_window_and_criteria',
      'stop_reassess_safety_referral_conditions','allowed_combinations',
      'conflicting_interventions','professional_source_refs','supersedes_id'
    ]) expect(names, required).toContain(required);
    for (const forbidden of [
      'approved','approval_status','reviewer_id','qualification_id','published'
    ]) expect(names).not.toContain(forbidden);

    for (const privilege of ['SELECT','INSERT','UPDATE']) {
      const result = await admin.query<{ has: boolean }>(
        "SELECT has_table_privilege('xiaoshuyin_app','intervention_definitions',$1) AS has",
        [privilege]
      );
      expect(result.rows[0]!.has, privilege).toBe(true);
    }
    for (const privilege of ['DELETE','TRUNCATE']) {
      const result = await admin.query<{ has: boolean }>(
        "SELECT has_table_privilege('xiaoshuyin_app','intervention_definitions',$1) AS has",
        [privilege]
      );
      expect(result.rows[0]!.has, privilege).toBe(false);
    }
  });

  it('keeps production candidate mutation unavailable without a real qualification consumer', async () => {
    const code = 'TEST_UNAVAILABLE_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    await expect(
      createInterventionDefinitionCandidate(appPool, {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode: code,
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('unavailable'),
      })
    ).rejects.toMatchObject({ code: 'INTERVENTION_QUALIFICATION_MISSING' });
    const count = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1',
      [code]
    );
    expect(count.rows[0]!.count).toBe('0');
  });

  it('creates a server-hashed candidate and records global business audit without fake Family', async () => {
    const semantic = interventionSemantic();
    const created = await createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode: 'TEST_HASH_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
        semantic,
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('hash'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    expect(created.version).toBe(1);
    expect(created.state).toBe('CANDIDATE');
    expect(created.contentHash).toBe(interventionDefinitionContentHash(semantic));

    const audit = await admin.query<{
      family_id: string | null;
      event_type: string;
      resource_type: string;
    }>(
      'SELECT family_id,event_type,resource_type FROM business_audit_events WHERE resource_id=$1',
      [created.id]
    );
    expect(audit.rows).toContainEqual({
      family_id: null,
      event_type: 'INTERVENTION_DEFINITION_CANDIDATE_CREATED',
      resource_type: 'INTERVENTION_DEFINITION',
    });

    await expect(
      admin.query(
        "INSERT INTO business_audit_events " +
          "(family_id,actor_account_id,event_type,resource_type,resource_id,metadata) " +
          "VALUES (NULL,$1,'MEMBER_CREATED','PERSON',$2,'{}'::jsonb)",
        [accountId, personId]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('same key + same semantic payload replays exact definition identity; different payload conflicts', async () => {
    const code = 'TEST_IDEM_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const idem = key('idem');
    const input = {
      actor: actor(),
      sceneId: 'DIGITAL_USE',
      interventionCode: code,
      semantic: interventionSemantic(),
      approvalScope: 'DIGITAL_USE',
      idempotencyKey: idem,
    };
    const first = await createInterventionDefinitionCandidate(
      appPool, input, TEST_ONLY_QUALIFICATION_PROVIDER
    );
    const replay = await createInterventionDefinitionCandidate(
      appPool, input, TEST_ONLY_QUALIFICATION_PROVIDER
    );
    expect(replay.id).toBe(first.id);
    expect(replay.contentHash).toBe(first.contentHash);

    await expect(
      createInterventionDefinitionCandidate(
        appPool,
        { ...input, semantic: interventionSemantic({ rationale: 'DIFFERENT_TEST_RATIONALE' }) },
        TEST_ONLY_QUALIFICATION_PROVIDER
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    const count = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1',
      [code]
    );
    expect(count.rows[0]!.count).toBe('1');
  });

  it('creates immutable successor versions, CAS-supersedes predecessor and retires terminally', async () => {
    const code = 'TEST_CHAIN_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const first = await createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(), sceneId: 'DIGITAL_USE', interventionCode: code,
        semantic: interventionSemantic(), approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('chain1'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    const successor = await createInterventionDefinitionSuccessor(
      appPool,
      {
        actor: actor(),
        predecessor: {
          id: first.id, version: first.version, contentHash: first.contentHash,
          expectedRevision: first.revision,
        },
        semantic: interventionSemantic({ rationale: 'MATERIAL_VERSION_2' }),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('chain2'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    expect(successor.version).toBe(2);
    expect(successor.supersedesId).toBe(first.id);

    const predecessor = await admin.query<{ definition_state: string; revision: number }>(
      'SELECT definition_state,revision FROM intervention_definitions WHERE id=$1',
      [first.id]
    );
    expect(predecessor.rows[0]).toMatchObject({ definition_state: 'SUPERSEDED', revision: 2 });

    await expect(
      admin.query(
        'UPDATE intervention_definitions SET rationale=$2 WHERE id=$1',
        [successor.id, 'MUTATE_IN_PLACE_FORBIDDEN']
      )
    ).rejects.toMatchObject({ code: '23514' });

    const retired = await retireInterventionDefinition(
      appPool,
      {
        actor: actor(),
        definition: {
          id: successor.id,
          version: successor.version,
          contentHash: successor.contentHash,
          expectedRevision: successor.revision,
        },
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('retire'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    expect(retired.state).toBe('RETIRED');

    await expect(
      createInterventionDefinitionSuccessor(
        appPool,
        {
          actor: actor(),
          predecessor: {
            id: successor.id, version: successor.version, contentHash: successor.contentHash,
            expectedRevision: retired.revision,
          },
          semantic: interventionSemantic({ rationale: 'FORBIDDEN_AFTER_RETIREMENT' }),
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: key('after-retire'),
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      )
    ).rejects.toBeTruthy();
  });

  it('registers only the bounded Slice 16 command vocabulary in the shared idempotency store', async () => {
    const constraint = await admin.query<{ definition: string }>(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint " +
        "WHERE conrelid='idempotency_keys'::regclass AND conname='idempotency_keys_command_type_check'"
    );
    for (const command of [
      'INTERVENTION_DEFINITION_CREATE',
      'INTERVENTION_DEFINITION_SUCCESSOR_CREATE',
      'INTERVENTION_DEFINITION_RETIRE',
      'INTERVENTION_DEFINITION_SUPERSEDE',
    ]) expect(constraint.rows[0]!.definition).toContain(command);
  });
});
