import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdminPool } from './setup/db.js';

describe('Slice 17 Professional Knowledge persistence', () => {
  const admin = createAdminPool();

  afterAll(async () => {
    await admin.end();
  });

  it('creates only the minimal normalized Professional Knowledge tables', async () => {
    const { rows } = await admin.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'professional_knowledge%'
        ORDER BY table_name`
    );
    expect(rows.map((row) => row.table_name)).toEqual([
      'professional_knowledge_approval_evidence',
      'professional_knowledge_items',
      'professional_knowledge_review_evidence',
      'professional_knowledge_sources',
      'professional_knowledge_versions',
    ]);

    const forbidden = await admin.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'knowledge_embeddings','knowledge_chunks','knowledge_package_inclusions',
            'scene_packages','reviewers','qualifications','professional_approvals',
            'knowledge_audit_ledger','knowledge_idempotency'
          )`
    );
    expect(forbidden.rows).toEqual([]);
  });

  it('separates lifecycle, review and validity constraints mechanically', async () => {
    const { rows } = await admin.query<{ conname: string; definition: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conrelid = 'professional_knowledge_versions'::regclass
        ORDER BY conname`
    );
    const byName = new Map(rows.map((row) => [row.conname, row.definition]));
    expect(byName.get('professional_knowledge_versions_lifecycle_check')).not.toContain(
      'NEEDS_REVIEW'
    );
    expect(byName.get('professional_knowledge_versions_review_state_check')).toContain(
      'NEEDS_REVIEW'
    );
    expect(byName.get('professional_knowledge_versions_validity_state_check')).toContain(
      'INVALID'
    );
  });

  it('enables and forces RLS and keeps runtime grants least privilege', async () => {
    const tables = [
      'professional_knowledge_items',
      'professional_knowledge_versions',
      'professional_knowledge_sources',
      'professional_knowledge_review_evidence',
      'professional_knowledge_approval_evidence',
    ];
    for (const table of tables) {
      const { rows } = await admin.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relrowsecurity, relforcerowsecurity
           FROM pg_class
          WHERE oid = $1::regclass`,
        [table]
      );
      expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      const deleteGrant = await admin.query<{ allowed: boolean }>(
        `SELECT has_table_privilege('xiaoshuyin_app', $1, 'DELETE') AS allowed`,
        [table]
      );
      expect(deleteGrant.rows[0]!.allowed).toBe(false);
    }

    const versionUpdate = await admin.query<{ allowed: boolean }>(
      `SELECT has_table_privilege(
          'xiaoshuyin_app','professional_knowledge_versions','UPDATE'
        ) AS allowed`
    );
    expect(versionUpdate.rows[0]!.allowed).toBe(true);

    for (const appendOnly of [
      'professional_knowledge_sources',
      'professional_knowledge_review_evidence',
      'professional_knowledge_approval_evidence',
    ]) {
      const update = await admin.query<{ allowed: boolean }>(
        `SELECT has_table_privilege('xiaoshuyin_app', $1, 'UPDATE') AS allowed`,
        [appendOnly]
      );
      expect(update.rows[0]!.allowed).toBe(false);
    }
  });

  it('reuses shared idempotency and business audit vocabularies', async () => {
    const idem = await admin.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conname = 'idempotency_keys_command_type_check'`
    );
    expect(idem.rows[0]!.definition).toContain(
      'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATE'
    );
    expect(idem.rows[0]!.definition).toContain('PROFESSIONAL_KNOWLEDGE_RELEASE');

    const resource = await admin.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conname = 'business_audit_events_resource_type_check'`
    );
    expect(resource.rows[0]!.definition).toContain('PROFESSIONAL_KNOWLEDGE');

    const duplicate = await admin.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('knowledge_audit_ledger','knowledge_idempotency')`
    );
    expect(duplicate.rows).toEqual([]);
  });

  it('keeps Professional Review Staff authority separate from qualification', async () => {
    const fn = await admin.query<{ definition: string }>(
      `SELECT pg_get_functiondef(
          'app.validate_professional_review_assignment(uuid,uuid,uuid)'::regprocedure
        ) AS definition`
    );
    expect(fn.rows[0]!.definition).toContain('PROFESSIONAL_REVIEW');
    expect(fn.rows[0]!.definition).not.toMatch(/qualification/i);
    expect(fn.rows[0]!.definition).not.toMatch(/approved\s*=\s*true/i);
  });
});
