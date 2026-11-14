-- Slice 14 — Digital Use Phone Use Contract Runtime
-- Bounded persistence only. Slice 12 remains the Scene State / Artifact owner.

CREATE TABLE digital_use_contract_versions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id uuid NOT NULL,
  case_id uuid NOT NULL,
  version integer NOT NULL,
  draft_revision integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT',
  adult_party_person_id uuid NOT NULL,
  child_party_person_id uuid NOT NULL,
  child_participation_id uuid NOT NULL REFERENCES case_participants(id) ON DELETE RESTRICT,
  contract_purpose jsonb NOT NULL,
  phone_use_rules jsonb NOT NULL,
  execution_period jsonb NOT NULL,
  parent_support_measures jsonb NOT NULL,
  supervision_measures jsonb NOT NULL,
  incentives jsonb NOT NULL,
  breach_responsibilities jsonb NOT NULL,
  source_template_version text NOT NULL,
  dependency_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  parent_confirmation jsonb,
  child_confirmation jsonb,
  supersedes_id uuid,
  update_reason text,
  update_trigger text,
  created_by_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  superseded_at timestamptz,
  paused_at timestamptz,

  CONSTRAINT digital_use_contract_versions_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases(id, family_id) ON DELETE RESTRICT,
  CONSTRAINT digital_use_contract_versions_adult_family_fk
    FOREIGN KEY (family_id, adult_party_person_id)
    REFERENCES family_members(family_id, person_id) ON DELETE RESTRICT,
  CONSTRAINT digital_use_contract_versions_child_family_fk
    FOREIGN KEY (family_id, child_party_person_id)
    REFERENCES family_members(family_id, person_id) ON DELETE RESTRICT,
  CONSTRAINT digital_use_contract_versions_creator_family_fk
    FOREIGN KEY (family_id, created_by_person_id)
    REFERENCES family_members(family_id, person_id) ON DELETE RESTRICT,
  CONSTRAINT digital_use_contract_versions_id_scope_key UNIQUE (id, case_id, family_id),
  CONSTRAINT digital_use_contract_versions_case_version_key UNIQUE (case_id, version),
  CONSTRAINT digital_use_contract_versions_revision_check CHECK (version >= 1 AND draft_revision >= 1),
  CONSTRAINT digital_use_contract_versions_status_check
    CHECK (status IN ('DRAFT','PENDING_CONFIRMATION','ACTIVE','SUPERSEDED','PAUSED')),
  CONSTRAINT digital_use_contract_versions_party_check CHECK (adult_party_person_id <> child_party_person_id),
  CONSTRAINT digital_use_contract_versions_template_check
    CHECK (length(source_template_version) BETWEEN 1 AND 128 AND source_template_version = btrim(source_template_version)),
  CONSTRAINT digital_use_contract_versions_terms_shape_check CHECK (
    jsonb_typeof(contract_purpose) = 'object'
    AND jsonb_typeof(phone_use_rules) = 'object'
    AND jsonb_typeof(execution_period) = 'object'
    AND jsonb_typeof(parent_support_measures) = 'object'
    AND jsonb_typeof(supervision_measures) = 'object'
    AND jsonb_typeof(incentives) = 'object'
    AND jsonb_typeof(breach_responsibilities) = 'object'
    AND jsonb_typeof(dependency_refs) = 'array'
    AND (parent_confirmation IS NULL OR jsonb_typeof(parent_confirmation) = 'object')
    AND (child_confirmation IS NULL OR jsonb_typeof(child_confirmation) = 'object')
  ),
  CONSTRAINT digital_use_contract_versions_update_trigger_check
    CHECK (update_trigger IS NULL OR update_trigger IN ('PERIOD_COMPLETE','NEW_PROBLEM')),
  CONSTRAINT digital_use_contract_versions_update_reason_check
    CHECK (update_reason IS NULL OR (
      update_reason = btrim(update_reason) AND length(update_reason) BETWEEN 1 AND 2000
    )),
  CONSTRAINT digital_use_contract_versions_status_timestamps_check CHECK (
    (status IN ('DRAFT','PENDING_CONFIRMATION')
      AND activated_at IS NULL AND superseded_at IS NULL AND paused_at IS NULL)
    OR
    (status = 'ACTIVE'
      AND activated_at IS NOT NULL AND superseded_at IS NULL AND paused_at IS NULL
      AND parent_confirmation IS NOT NULL AND child_confirmation IS NOT NULL)
    OR
    (status = 'SUPERSEDED' AND activated_at IS NOT NULL AND superseded_at IS NOT NULL)
    OR
    (status = 'PAUSED' AND activated_at IS NOT NULL AND superseded_at IS NULL AND paused_at IS NOT NULL)
  ),
  CONSTRAINT digital_use_contract_versions_confirmation_revision_check CHECK (
    (parent_confirmation IS NULL OR (
      parent_confirmation ? 'draftRevision'
      AND jsonb_typeof(parent_confirmation -> 'draftRevision') = 'number'
      AND (parent_confirmation ->> 'draftRevision')::integer = draft_revision
    ))
    AND
    (child_confirmation IS NULL OR (
      child_confirmation ? 'draftRevision'
      AND jsonb_typeof(child_confirmation -> 'draftRevision') = 'number'
      AND (child_confirmation ->> 'draftRevision')::integer = draft_revision
    ))
  ),
  CONSTRAINT digital_use_contract_versions_supersedes_self_check CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT digital_use_contract_versions_initial_or_revision_check CHECK (
    (supersedes_id IS NULL AND version = 1 AND update_trigger IS NULL)
    OR
    (supersedes_id IS NOT NULL AND version > 1 AND update_trigger IS NOT NULL AND update_reason IS NOT NULL)
  )
);

ALTER TABLE digital_use_contract_versions
  ADD CONSTRAINT digital_use_contract_versions_supersedes_scope_fk
  FOREIGN KEY (supersedes_id, case_id, family_id)
  REFERENCES digital_use_contract_versions(id, case_id, family_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX digital_use_contract_versions_one_active_per_case
  ON digital_use_contract_versions(case_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX digital_use_contract_versions_one_open_draft_per_case
  ON digital_use_contract_versions(case_id) WHERE status IN ('DRAFT','PENDING_CONFIRMATION');
CREATE UNIQUE INDEX digital_use_contract_versions_one_successor_per_version
  ON digital_use_contract_versions(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX digital_use_contract_versions_family_case_idx
  ON digital_use_contract_versions(family_id, case_id, version DESC);

CREATE FUNCTION digital_use_contract_versions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE material_changed boolean;
BEGIN
  IF NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.adult_party_person_id IS DISTINCT FROM OLD.adult_party_person_id
     OR NEW.child_party_person_id IS DISTINCT FROM OLD.child_party_person_id
     OR NEW.child_participation_id IS DISTINCT FROM OLD.child_participation_id
     OR NEW.source_template_version IS DISTINCT FROM OLD.source_template_version
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
     OR NEW.created_by_person_id IS DISTINCT FROM OLD.created_by_person_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_IMMUTABLE_IDENTITY' USING ERRCODE = '23514';
  END IF;

  material_changed :=
       NEW.contract_purpose IS DISTINCT FROM OLD.contract_purpose
    OR NEW.phone_use_rules IS DISTINCT FROM OLD.phone_use_rules
    OR NEW.execution_period IS DISTINCT FROM OLD.execution_period
    OR NEW.parent_support_measures IS DISTINCT FROM OLD.parent_support_measures
    OR NEW.supervision_measures IS DISTINCT FROM OLD.supervision_measures
    OR NEW.incentives IS DISTINCT FROM OLD.incentives
    OR NEW.breach_responsibilities IS DISTINCT FROM OLD.breach_responsibilities
    OR NEW.dependency_refs IS DISTINCT FROM OLD.dependency_refs;

  IF OLD.status IN ('ACTIVE','SUPERSEDED','PAUSED') AND material_changed THEN
    RAISE EXCEPTION 'PHONE_USE_CONTRACT_ACTIVE_TERMS_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF material_changed THEN
    IF OLD.status NOT IN ('DRAFT','PENDING_CONFIRMATION')
       OR NEW.status <> 'DRAFT'
       OR NEW.draft_revision <> OLD.draft_revision + 1
       OR NEW.parent_confirmation IS NOT NULL
       OR NEW.child_confirmation IS NOT NULL
    THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_DRAFT_REVISION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.draft_revision <> OLD.draft_revision THEN
    RAISE EXCEPTION 'PHONE_USE_CONTRACT_DRAFT_REVISION_INVALID' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('DRAFT','PENDING_CONFIRMATION','ACTIVE'))
    OR (OLD.status = 'PENDING_CONFIRMATION' AND NEW.status IN ('DRAFT','PENDING_CONFIRMATION','ACTIVE'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('ACTIVE','SUPERSEDED'))
    OR (OLD.status = 'PAUSED' AND NEW.status IN ('PAUSED','ACTIVE','SUPERSEDED'))
    OR (OLD.status = 'SUPERSEDED' AND NEW.status = 'SUPERSEDED')
  ) THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_STATUS_TRANSITION_INVALID' USING ERRCODE = '23514';
  END IF;

  IF OLD.status IN ('ACTIVE','SUPERSEDED')
     AND (NEW.parent_confirmation IS DISTINCT FROM OLD.parent_confirmation
       OR NEW.child_confirmation IS DISTINCT FROM OLD.child_confirmation)
  THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_CONFIRMATION_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER digital_use_contract_versions_guard
  BEFORE UPDATE ON digital_use_contract_versions
  FOR EACH ROW EXECUTE FUNCTION digital_use_contract_versions_guard();

CREATE TABLE roleplay_sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_person_id uuid NOT NULL,
  simulation_role text NOT NULL DEFAULT 'ADULT_PLAYS_CHILD_AI_SIMULATES_PARENT',
  status text NOT NULL DEFAULT 'OPEN',
  scene_package_version text NOT NULL,
  professional_content_version text NOT NULL,
  compliance_policy_ref text NOT NULL,
  adapter_ref text NOT NULL,
  selected_turn_id uuid,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT roleplay_sessions_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases(id, family_id) ON DELETE RESTRICT,
  CONSTRAINT roleplay_sessions_actor_family_fk
    FOREIGN KEY (family_id, actor_person_id) REFERENCES family_members(family_id, person_id) ON DELETE RESTRICT,
  CONSTRAINT roleplay_sessions_id_scope_key UNIQUE(id, case_id, family_id),
  CONSTRAINT roleplay_sessions_status_check CHECK (status IN ('OPEN','COMPLETED')),
  CONSTRAINT roleplay_sessions_role_check CHECK (simulation_role = 'ADULT_PLAYS_CHILD_AI_SIMULATES_PARENT'),
  CONSTRAINT roleplay_sessions_revision_check CHECK (revision >= 1),
  CONSTRAINT roleplay_sessions_version_refs_check CHECK (
    length(scene_package_version) BETWEEN 1 AND 64
    AND length(professional_content_version) BETWEEN 1 AND 128
    AND length(compliance_policy_ref) BETWEEN 1 AND 256
    AND length(adapter_ref) BETWEEN 1 AND 256
  ),
  CONSTRAINT roleplay_sessions_completion_shape_check CHECK (
    (status = 'OPEN' AND completed_at IS NULL)
    OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND selected_turn_id IS NOT NULL)
  )
);

CREATE TABLE roleplay_turns (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id uuid NOT NULL,
  case_id uuid NOT NULL,
  session_id uuid NOT NULL,
  round_number integer NOT NULL,
  simulated_child_input text NOT NULL,
  simulated_parent_output text NOT NULL,
  provenance text NOT NULL DEFAULT 'SIMULATION',
  model_ref text,
  prompt_version_ref text,
  user_rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roleplay_turns_session_scope_fk
    FOREIGN KEY (session_id, case_id, family_id)
    REFERENCES roleplay_sessions(id, case_id, family_id) ON DELETE RESTRICT,
  CONSTRAINT roleplay_turns_id_session_key UNIQUE(id, session_id),
  CONSTRAINT roleplay_turns_round_key UNIQUE(session_id, round_number),
  CONSTRAINT roleplay_turns_round_check CHECK (round_number >= 1),
  CONSTRAINT roleplay_turns_provenance_check CHECK (provenance = 'SIMULATION'),
  CONSTRAINT roleplay_turns_input_check CHECK (
    simulated_child_input = btrim(simulated_child_input)
    AND length(simulated_child_input) BETWEEN 1 AND 8000
  ),
  CONSTRAINT roleplay_turns_output_check CHECK (
    simulated_parent_output = btrim(simulated_parent_output)
    AND length(simulated_parent_output) BETWEEN 1 AND 16000
  ),
  CONSTRAINT roleplay_turns_rating_check CHECK (user_rating IS NULL OR user_rating BETWEEN 1 AND 5)
);

ALTER TABLE roleplay_sessions
  ADD CONSTRAINT roleplay_sessions_selected_turn_fk
  FOREIGN KEY (selected_turn_id, id) REFERENCES roleplay_turns(id, session_id) ON DELETE RESTRICT;

CREATE INDEX roleplay_sessions_family_case_idx ON roleplay_sessions(family_id, case_id, created_at DESC);
CREATE INDEX roleplay_turns_session_round_idx ON roleplay_turns(session_id, round_number);

ALTER TABLE digital_use_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_use_contract_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE roleplay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplay_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE roleplay_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplay_turns FORCE ROW LEVEL SECURITY;

CREATE POLICY digital_use_contract_versions_scope ON digital_use_contract_versions
  USING (
    family_id = app_family_id()
    AND (
      app_current_purpose() = 'FAMILY_MANAGEMENT'
      OR (app_current_purpose() = 'PHONE_USE_CONTRACT' AND child_party_person_id = app_person_id())
    )
  )
  WITH CHECK (
    family_id = app_family_id()
    AND (
      app_current_purpose() = 'FAMILY_MANAGEMENT'
      OR (app_current_purpose() = 'PHONE_USE_CONTRACT' AND child_party_person_id = app_person_id())
    )
  );

CREATE POLICY roleplay_sessions_scope ON roleplay_sessions
  USING (family_id = app_family_id() AND app_current_purpose() = 'FAMILY_MANAGEMENT' AND actor_person_id = app_person_id())
  WITH CHECK (family_id = app_family_id() AND app_current_purpose() = 'FAMILY_MANAGEMENT' AND actor_person_id = app_person_id());

CREATE POLICY roleplay_turns_scope ON roleplay_turns
  USING (
    family_id = app_family_id() AND app_current_purpose() = 'FAMILY_MANAGEMENT'
    AND EXISTS (
      SELECT 1 FROM roleplay_sessions s
      WHERE s.id = roleplay_turns.session_id AND s.actor_person_id = app_person_id()
    )
  )
  WITH CHECK (
    family_id = app_family_id() AND app_current_purpose() = 'FAMILY_MANAGEMENT'
    AND EXISTS (
      SELECT 1 FROM roleplay_sessions s
      WHERE s.id = roleplay_turns.session_id AND s.actor_person_id = app_person_id()
    )
  );

GRANT SELECT, INSERT ON digital_use_contract_versions TO xiaoshuyin_app;
GRANT UPDATE (
  draft_revision, status, contract_purpose, phone_use_rules, execution_period,
  parent_support_measures, supervision_measures, incentives, breach_responsibilities,
  dependency_refs, parent_confirmation, child_confirmation,
  updated_at, activated_at, superseded_at, paused_at
) ON digital_use_contract_versions TO xiaoshuyin_app;
GRANT SELECT, INSERT ON roleplay_sessions TO xiaoshuyin_app;
GRANT UPDATE (status, selected_turn_id, revision, completed_at) ON roleplay_sessions TO xiaoshuyin_app;
GRANT SELECT, INSERT ON roleplay_turns TO xiaoshuyin_app;
GRANT UPDATE (user_rating) ON roleplay_turns TO xiaoshuyin_app;

ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_type_check;
ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_type_check CHECK (
  artifact_type IN (
    'SUPPLEMENTAL_ASSESSMENT_BOUNDARY','TIMELINE','SOLUTION_SUMMARY',
    'PHONE_USE_CONTRACT_QUIZ_ATTEMPT','PHONE_USE_CONTRACT_TOOL_SELECTION',
    'PHONE_USE_DURATION_COMPONENT','PHONE_USE_SUPERVISION_COMPONENT','PHONE_USE_SUPERVISION_LOG',
    'PHONE_USE_INCENTIVE_COMPONENT','PHONE_USE_BREACH_COMPONENT',
    'PARENT_SELF_REGULATION_CHECKLIST','PHONE_USE_CONTRACT_DOCUMENT','PHONE_USE_CONTRACT_SUPPORT_LOG'
  )
);
ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_source_node_check;
ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_source_node_check CHECK (
  source_node_code IN ('01000','A2007','A2010','A4001','A4004','A4005','A4006','A4007','A4008','A4009','A4010','A4011','A4012')
);
ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_type_source_check;
ALTER TABLE scene_artifacts ADD CONSTRAINT scene_artifacts_type_source_check CHECK (
  (artifact_type='SUPPLEMENTAL_ASSESSMENT_BOUNDARY' AND source_node_code='01000')
  OR (artifact_type='TIMELINE' AND source_node_code='A2007')
  OR (artifact_type='SOLUTION_SUMMARY' AND source_node_code='A2010')
  OR (artifact_type='PHONE_USE_CONTRACT_QUIZ_ATTEMPT' AND source_node_code='A4001')
  OR (artifact_type='PHONE_USE_CONTRACT_TOOL_SELECTION' AND source_node_code='A4004')
  OR (artifact_type='PHONE_USE_DURATION_COMPONENT' AND source_node_code='A4005')
  OR (artifact_type IN ('PHONE_USE_SUPERVISION_COMPONENT','PHONE_USE_SUPERVISION_LOG') AND source_node_code='A4006')
  OR (artifact_type='PHONE_USE_INCENTIVE_COMPONENT' AND source_node_code='A4007')
  OR (artifact_type='PHONE_USE_BREACH_COMPONENT' AND source_node_code='A4008')
  OR (artifact_type='PARENT_SELF_REGULATION_CHECKLIST' AND source_node_code='A4009')
  OR (artifact_type='PHONE_USE_CONTRACT_DOCUMENT' AND source_node_code IN ('A4010','A4012'))
  OR (artifact_type='PHONE_USE_CONTRACT_SUPPORT_LOG' AND source_node_code='A4011')
);

ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_keys_command_type_check;
ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_command_type_check CHECK (
  command_type IN (
    'FAMILY_CREATE','MEMBER_CREATE','MEMBER_UPDATE',
    'GUARDIAN_CONSENT_REQUEST','GUARDIAN_CONSENT_GRANT','GUARDIAN_CONSENT_REVOKE',
    'CASE_CREATE','CASE_MESSAGE_CREATE',
    'PARTICIPATION_INVITE_CREATE','PARTICIPATION_ACCEPT','PARTICIPATION_DECLINE','PARTICIPATION_WITHDRAW',
    'CASE_SWITCH_PRIMARY','CASE_START_ASSESSMENT',
    'PROBLEM_FORMULATION_PRESENT','PROBLEM_FORMULATION_CONFIRM','PROBLEM_FORMULATION_DISPUTE',
    'PROBLEM_FORMULATION_CORRECT','CASE_REASSESS_FROM_FORMULATION',
    'CASE_ENTER_SAFETY_HOLD','CASE_RESOLVE_RISK',
    'DIGITAL_USE_ASSESSMENT_RESUME','DIGITAL_USE_NODE_RESPONSE',
    'PHONE_USE_CONTRACT_DRAFT_SAVE','PHONE_USE_CONTRACT_CONFIRM','PHONE_USE_CONTRACT_REVISE',
    'PHONE_USE_ROLEPLAY_CREATE','PHONE_USE_ROLEPLAY_TURN','PHONE_USE_ROLEPLAY_RATE','PHONE_USE_ROLEPLAY_SELECT'
  )
);

ALTER TABLE business_audit_events DROP CONSTRAINT business_audit_events_event_type_check;
ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_event_type_check CHECK (
  event_type IN (
    'FAMILY_CREATED','MEMBER_CREATED','MEMBER_PROFILE_VALUE_RECORDED',
    'CONSENT_REQUEST_CREATED','CONSENT_GRANTED','CONSENT_REVOKED',
    'CASE_CREATED','MESSAGE_RECORDED','ASSERTION_RECORDED','OBSERVATION_RECORDED',
    'PARTICIPATION_INVITE_CREATED','PARTICIPATION_ACCEPTED','PARTICIPATION_DECLINED',
    'PARTICIPATION_EXPIRED','PARTICIPATION_WITHDRAWN',
    'CASE_PRIMARY_SWITCHED','CASE_ASSESSMENT_STARTED',
    'CASE_PROBLEM_FORMULATION_PRESENTED','CASE_PROBLEM_FORMULATION_CONFIRMED',
    'CASE_PROBLEM_FORMULATION_DISPUTED','CASE_PROBLEM_FORMULATION_CORRECTED',
    'CASE_REASSESSMENT_STARTED','CASE_SAFETY_HOLD_ENTERED','CASE_RISK_RESOLVED',
    'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED','CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
    'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED','DIGITAL_USE_NODE_COMPLETED',
    'PHONE_USE_CONTRACT_DRAFT_SAVED','PHONE_USE_CONTRACT_CONFIRMED',
    'PHONE_USE_CONTRACT_ACTIVATED','PHONE_USE_CONTRACT_SUPERSEDED','PHONE_USE_ROLEPLAY_RECORDED'
  )
);
