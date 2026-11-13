-- ============================================================================
-- Slice 12 — Digital Use Assessment Runtime
-- Migration: 015_digital_use_assessment_runtime.sql
--
-- Additive persistence only. These tables project Scene progression and
-- user-visible artifacts; substantive Assessment facts remain in Evidence.
-- No assessment answers table, second router/manifest, consent ledger, safety
-- state, compliance evaluator, scheduler, A3000 runtime or model truth exists.
-- ============================================================================

CREATE TYPE scene_node_status AS ENUM (
  'LOCKED',
  'AVAILABLE',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'BLOCKED'
);

CREATE TABLE scene_node_states (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id              uuid NOT NULL,
  case_id                uuid NOT NULL,
  scene_package_version  text NOT NULL,
  node_code              text NOT NULL,
  source_node_code       text NOT NULL,
  status                 scene_node_status NOT NULL,
  branch_reason_codes    text[] NOT NULL DEFAULT ARRAY[]::text[],
  input_refs             jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_refs            jsonb NOT NULL DEFAULT '[]'::jsonb,
  entered_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,
  revision               integer NOT NULL DEFAULT 1,

  CONSTRAINT scene_node_states_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id)
    ON DELETE RESTRICT,
  CONSTRAINT scene_node_states_case_node_key UNIQUE (case_id, node_code),
  CONSTRAINT scene_node_states_id_case_family_key UNIQUE (id, case_id, family_id),
  CONSTRAINT scene_node_states_revision_check CHECK (revision >= 1),
  CONSTRAINT scene_node_states_package_check CHECK (
    length(scene_package_version) BETWEEN 1 AND 64
    AND scene_package_version = btrim(scene_package_version)
  ),
  CONSTRAINT scene_node_states_node_code_check CHECK (
    length(node_code) BETWEEN 1 AND 64
    AND node_code = btrim(node_code)
    AND node_code <> 'A200401'
  ),
  CONSTRAINT scene_node_states_source_node_code_check CHECK (
    length(source_node_code) BETWEEN 1 AND 64
    AND source_node_code = btrim(source_node_code)
  ),
  CONSTRAINT scene_node_states_refs_shape_check CHECK (
    jsonb_typeof(input_refs) = 'array'
    AND jsonb_typeof(output_refs) = 'array'
  ),
  CONSTRAINT scene_node_states_completion_shape_check CHECK (
    (
      status IN ('COMPLETED', 'SKIPPED', 'BLOCKED')
      AND completed_at IS NOT NULL
    )
    OR
    (
      status IN ('LOCKED', 'AVAILABLE', 'IN_PROGRESS')
      AND completed_at IS NULL
    )
  )
);

CREATE INDEX scene_node_states_case_status_idx
  ON scene_node_states (case_id, status, entered_at ASC);
CREATE INDEX scene_node_states_family_case_idx
  ON scene_node_states (family_id, case_id, entered_at ASC);

CREATE FUNCTION scene_node_states_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_anchor_package text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id
       OR NEW.family_id <> OLD.family_id
       OR NEW.case_id <> OLD.case_id
       OR NEW.scene_package_version <> OLD.scene_package_version
       OR NEW.node_code <> OLD.node_code
       OR NEW.source_node_code <> OLD.source_node_code
       OR NEW.entered_at <> OLD.entered_at
    THEN
      RAISE EXCEPTION 'SCENE_NODE_STATE_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'SCENE_NODE_STATE_REVISION_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.node_code <> 'A1001' THEN
    SELECT scene_package_version INTO v_anchor_package
      FROM scene_node_states
     WHERE case_id = NEW.case_id
       AND node_code = 'A1001';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SCENE_PACKAGE_ANCHOR_MISSING' USING ERRCODE = '23514';
    END IF;
    IF v_anchor_package <> NEW.scene_package_version THEN
      RAISE EXCEPTION 'SCENE_PACKAGE_BINDING_MISMATCH' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER scene_node_states_guard
  BEFORE INSERT OR UPDATE ON scene_node_states
  FOR EACH ROW EXECUTE FUNCTION scene_node_states_guard();

CREATE TABLE scene_artifacts (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id              uuid NOT NULL,
  case_id                uuid NOT NULL,
  scene_package_version  text NOT NULL,
  artifact_type          text NOT NULL,
  schema_version         text NOT NULL,
  source_node_code       text NOT NULL,
  data                   jsonb NOT NULL,
  owner_person_id        uuid NOT NULL,
  visibility             text NOT NULL,
  source_refs            jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision               integer NOT NULL,
  supersedes_id          uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scene_artifacts_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id)
    ON DELETE RESTRICT,
  CONSTRAINT scene_artifacts_owner_family_fk
    FOREIGN KEY (family_id, owner_person_id)
    REFERENCES family_members (family_id, person_id)
    ON DELETE RESTRICT,
  CONSTRAINT scene_artifacts_id_case_family_key UNIQUE (id, case_id, family_id),
  CONSTRAINT scene_artifacts_supersedes_same_case_fk
    FOREIGN KEY (supersedes_id, case_id, family_id)
    REFERENCES scene_artifacts (id, case_id, family_id)
    ON DELETE RESTRICT,
  CONSTRAINT scene_artifacts_revision_check CHECK (revision >= 1),
  CONSTRAINT scene_artifacts_package_check CHECK (
    length(scene_package_version) BETWEEN 1 AND 64
    AND scene_package_version = btrim(scene_package_version)
  ),
  CONSTRAINT scene_artifacts_type_check CHECK (
    artifact_type IN (
      'SUPPLEMENTAL_ASSESSMENT_BOUNDARY',
      'TIMELINE',
      'SOLUTION_SUMMARY'
    )
  ),
  CONSTRAINT scene_artifacts_schema_version_check CHECK (
    length(schema_version) BETWEEN 1 AND 64
    AND schema_version = btrim(schema_version)
  ),
  CONSTRAINT scene_artifacts_source_node_check CHECK (
    source_node_code IN ('01000', 'A2007', 'A2010')
  ),
  CONSTRAINT scene_artifacts_type_source_check CHECK (
    (artifact_type = 'SUPPLEMENTAL_ASSESSMENT_BOUNDARY' AND source_node_code = '01000')
    OR (artifact_type = 'TIMELINE' AND source_node_code = 'A2007')
    OR (artifact_type = 'SOLUTION_SUMMARY' AND source_node_code = 'A2010')
  ),
  CONSTRAINT scene_artifacts_data_shape_check CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT scene_artifacts_refs_shape_check CHECK (jsonb_typeof(source_refs) = 'array'),
  CONSTRAINT scene_artifacts_visibility_check CHECK (visibility = 'FAMILY_AUTHORIZED')
);

CREATE UNIQUE INDEX scene_artifacts_scope_revision_key
  ON scene_artifacts (case_id, artifact_type, source_node_code, revision);
CREATE UNIQUE INDEX scene_artifacts_supersedes_key
  ON scene_artifacts (supersedes_id)
  WHERE supersedes_id IS NOT NULL;
CREATE INDEX scene_artifacts_case_time_idx
  ON scene_artifacts (case_id, created_at ASC, id ASC);

CREATE FUNCTION scene_artifacts_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_anchor_package text;
  v_previous scene_artifacts%ROWTYPE;
BEGIN
  SELECT scene_package_version INTO v_anchor_package
    FROM scene_node_states
   WHERE case_id = NEW.case_id
     AND node_code = 'A1001';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SCENE_PACKAGE_ANCHOR_MISSING' USING ERRCODE = '23514';
  END IF;
  IF v_anchor_package <> NEW.scene_package_version THEN
    RAISE EXCEPTION 'SCENE_PACKAGE_BINDING_MISMATCH' USING ERRCODE = '23514';
  END IF;

  IF NEW.supersedes_id IS NULL THEN
    IF NEW.revision <> 1 THEN
      RAISE EXCEPTION 'SCENE_ARTIFACT_REVISION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT * INTO v_previous
      FROM scene_artifacts
     WHERE id = NEW.supersedes_id
     FOR UPDATE;

    IF NOT FOUND
       OR v_previous.family_id <> NEW.family_id
       OR v_previous.case_id <> NEW.case_id
       OR v_previous.scene_package_version <> NEW.scene_package_version
       OR v_previous.artifact_type <> NEW.artifact_type
       OR v_previous.source_node_code <> NEW.source_node_code
       OR v_previous.owner_person_id <> NEW.owner_person_id
       OR NEW.revision <> v_previous.revision + 1
    THEN
      RAISE EXCEPTION 'SCENE_ARTIFACT_SUPERSESSION_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER scene_artifacts_insert_guard
  BEFORE INSERT ON scene_artifacts
  FOR EACH ROW EXECUTE FUNCTION scene_artifacts_insert_guard();

ALTER TABLE scene_node_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_node_states FORCE ROW LEVEL SECURITY;
ALTER TABLE scene_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_artifacts FORCE ROW LEVEL SECURITY;

CREATE POLICY scene_node_states_family_scope ON scene_node_states
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

CREATE POLICY scene_artifacts_family_scope ON scene_artifacts
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

GRANT SELECT, INSERT ON scene_node_states TO xiaoshuyin_app;
GRANT UPDATE (
  status,
  branch_reason_codes,
  input_refs,
  output_refs,
  completed_at,
  revision
) ON scene_node_states TO xiaoshuyin_app;

GRANT SELECT, INSERT ON scene_artifacts TO xiaoshuyin_app;
GRANT USAGE ON TYPE scene_node_status TO xiaoshuyin_app;

-- ── Shared vocabularies required by the approved Scene runtime ─────────────
ALTER TABLE case_events DROP CONSTRAINT case_events_event_type_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_event_type_check CHECK (
    event_type IN (
      'CASE_CREATED',
      'CASE_PRIMARY_ASSIGNED',
      'CASE_PRIMARY_REVOKED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED',
      'CASE_DIGITAL_USE_NODE_COMPLETED'
    )
  );

ALTER TABLE case_events DROP CONSTRAINT case_events_metadata_shape_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_metadata_shape_check CHECK (
    (
      event_type = 'CASE_CREATED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata - 'primary' - 'version' = '{}'::jsonb
      AND jsonb_typeof(metadata -> 'primary') = 'boolean'
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
    )
    OR (
      event_type = 'CASE_PRIMARY_ASSIGNED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata ? 'previousPrimaryCaseId'
      AND metadata ? 'reason'
      AND metadata - 'primary' - 'version' - 'previousPrimaryCaseId' - 'reason' = '{}'::jsonb
      AND metadata -> 'primary' = 'true'::jsonb
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
      AND (
            jsonb_typeof(metadata -> 'previousPrimaryCaseId') = 'null'
            OR jsonb_typeof(metadata -> 'previousPrimaryCaseId') = 'string'
          )
      AND jsonb_typeof(metadata -> 'reason') = 'string'
      AND btrim(metadata ->> 'reason') <> ''
      AND length(metadata ->> 'reason') <= 500
    )
    OR (
      event_type = 'CASE_PRIMARY_REVOKED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata ? 'newPrimaryCaseId'
      AND metadata ? 'reason'
      AND metadata - 'primary' - 'version' - 'newPrimaryCaseId' - 'reason' = '{}'::jsonb
      AND metadata -> 'primary' = 'false'::jsonb
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
      AND jsonb_typeof(metadata -> 'newPrimaryCaseId') = 'string'
      AND jsonb_typeof(metadata -> 'reason') = 'string'
      AND btrim(metadata ->> 'reason') <> ''
      AND length(metadata ->> 'reason') <= 500
    )
    OR (
      event_type = 'CASE_ASSESSMENT_STARTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'INTAKE'
      AND metadata ->> 'toPhase' = 'ASSESSMENT'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_PRESENTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'ASSESSMENT'
      AND metadata ->> 'toPhase' = 'PROBLEM_FORMULATION'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromStatus' - 'toStatus' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromStatus' = 'PRESENTED'
      AND metadata ->> 'toStatus' = 'CONFIRMED'
      AND metadata ->> 'fromPhase' = 'PROBLEM_FORMULATION'
      AND metadata ->> 'toPhase' = 'GOALS'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_DISPUTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromStatus' - 'toStatus' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromStatus' = 'PRESENTED'
      AND metadata ->> 'toStatus' = 'DISPUTED'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromFormulationVersion'
      AND metadata ? 'toFormulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'version'
      AND metadata - 'fromFormulationVersion' - 'toFormulationVersion' - 'fromStatus' - 'toStatus' - 'version' = '{}'::jsonb
      AND metadata ->> 'toStatus' = 'PRESENTED'
      AND jsonb_typeof(metadata -> 'fromFormulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'toFormulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_REASSESSMENT_STARTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'PROBLEM_FORMULATION'
      AND metadata ->> 'toPhase' = 'ASSESSMENT'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
      OR (
      event_type = 'CASE_DIGITAL_USE_NODE_COMPLETED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'scenePackageVersion'
      AND metadata ? 'nodeCode'
      AND metadata ? 'nodeRevision'
      AND metadata ? 'routeReasonCode'
      AND metadata ? 'inputRefs'
      AND metadata ? 'outputRefs'
      AND metadata ? 'nextNodeCode'
      AND metadata ? 'terminalCode'
      AND metadata - 'scenePackageVersion' - 'nodeCode' - 'nodeRevision'
                   - 'routeReasonCode' - 'inputRefs' - 'outputRefs'
                   - 'nextNodeCode' - 'terminalCode' = '{}'::jsonb
      AND jsonb_typeof(metadata -> 'scenePackageVersion') = 'string'
      AND jsonb_typeof(metadata -> 'nodeCode') = 'string'
      AND jsonb_typeof(metadata -> 'nodeRevision') = 'number'
      AND jsonb_typeof(metadata -> 'routeReasonCode') IN ('string','null')
      AND jsonb_typeof(metadata -> 'inputRefs') = 'array'
      AND jsonb_typeof(metadata -> 'outputRefs') = 'array'
      AND jsonb_typeof(metadata -> 'nextNodeCode') IN ('string','null')
      AND jsonb_typeof(metadata -> 'terminalCode') IN ('string','null')
    )
      OR (
      event_type IN ('CASE_SAFETY_HOLD_ENTERED', 'CASE_RISK_RESOLVED')
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'fromVersion'
      AND metadata ? 'toVersion'
      AND metadata ? 'riskEventId'
      AND metadata - 'fromStatus' - 'toStatus' - 'fromVersion' - 'toVersion'
                  - 'riskEventId' = '{}'::jsonb
      AND jsonb_typeof(metadata -> 'fromStatus') = 'string'
      AND jsonb_typeof(metadata -> 'toStatus') = 'string'
      AND jsonb_typeof(metadata -> 'riskEventId') = 'string'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'fromVersion') = 'number'
             AND jsonb_typeof(metadata -> 'toVersion') = 'number'
            THEN (metadata ->> 'fromVersion')::numeric = trunc((metadata ->> 'fromVersion')::numeric)
                 AND (metadata ->> 'toVersion')::numeric = trunc((metadata ->> 'toVersion')::numeric)
                 AND (metadata ->> 'fromVersion')::numeric >= 1
                 AND (metadata ->> 'toVersion')::numeric >= 1
            ELSE false
          END
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_event_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_event_type_check CHECK (
    event_type IN (
      'FAMILY_CREATED',
      'MEMBER_CREATED',
      'MEMBER_PROFILE_VALUE_RECORDED',
      'CONSENT_REQUEST_CREATED',
      'CONSENT_GRANTED',
      'CONSENT_REVOKED',
      'CASE_CREATED',
      'MESSAGE_RECORDED',
      'ASSERTION_RECORDED',
      'OBSERVATION_RECORDED',
      'PARTICIPATION_INVITE_CREATED',
      'PARTICIPATION_ACCEPTED',
      'PARTICIPATION_DECLINED',
      'PARTICIPATION_EXPIRED',
      'PARTICIPATION_WITHDRAWN',
      'CASE_PRIMARY_SWITCHED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED',
      'DIGITAL_USE_NODE_COMPLETED'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_command_type_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_command_type_check CHECK (
    command_type IN (
      'FAMILY_CREATE',
      'MEMBER_CREATE',
      'MEMBER_UPDATE',
      'GUARDIAN_CONSENT_REQUEST',
      'GUARDIAN_CONSENT_GRANT',
      'GUARDIAN_CONSENT_REVOKE',
      'CASE_CREATE',
      'CASE_MESSAGE_CREATE',
      'PARTICIPATION_INVITE_CREATE',
      'PARTICIPATION_ACCEPT',
      'PARTICIPATION_DECLINE',
      'PARTICIPATION_WITHDRAW',
      'CASE_SWITCH_PRIMARY',
      'CASE_START_ASSESSMENT',
      'PROBLEM_FORMULATION_PRESENT',
      'PROBLEM_FORMULATION_CONFIRM',
      'PROBLEM_FORMULATION_DISPUTE',
      'PROBLEM_FORMULATION_CORRECT',
      'CASE_REASSESS_FROM_FORMULATION',
      'CASE_ENTER_SAFETY_HOLD',
      'CASE_RESOLVE_RISK',
      'DIGITAL_USE_ASSESSMENT_RESUME',
      'DIGITAL_USE_NODE_RESPONSE'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_key_representation_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type NOT IN (
        'CASE_CREATE',
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK',
        'DIGITAL_USE_ASSESSMENT_RESUME',
        'DIGITAL_USE_NODE_RESPONSE'
      )
      AND idempotency_key IS NOT NULL
      AND idempotency_key_bytes IS NULL
    )
    OR (
      command_type = 'CASE_CREATE'
      AND (
        (idempotency_key IS NOT NULL AND idempotency_key_bytes IS NULL)
        OR (idempotency_key IS NULL AND idempotency_key_bytes IS NOT NULL)
      )
    )
    OR (
      command_type IN (
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK',
        'DIGITAL_USE_ASSESSMENT_RESUME',
        'DIGITAL_USE_NODE_RESPONSE'
      )
      AND idempotency_key IS NULL
      AND idempotency_key_bytes IS NOT NULL
    )
  );
