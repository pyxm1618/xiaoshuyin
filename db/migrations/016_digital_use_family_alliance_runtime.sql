-- ============================================================================
-- Slice 13 — Digital Use Family Alliance Runtime
-- Migration: 016_digital_use_family_alliance_runtime.sql
--
-- Additive Family Alliance Scene persistence only. The existing Slice 12
-- scene_node_states / scene_artifacts remain the Scene runtime authority.
-- Target List state is a bounded revisioned Scene artifact, never Goal/Task.
-- ============================================================================

CREATE TABLE digital_use_target_items (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id              uuid NOT NULL,
  case_id                uuid NOT NULL,
  scene_package_version  text NOT NULL,
  target_code            text NOT NULL,
  selection_revision     integer NOT NULL,
  revision               integer NOT NULL,
  selected               boolean NOT NULL,
  concrete_target_text   text,
  feasibility_payload    jsonb,
  progress_payload       jsonb,
  progress_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  help_history_refs      jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_person_id   uuid NOT NULL,
  supersedes_id          uuid,
  superseded_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT digital_use_target_items_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_use_target_items_creator_family_fk
    FOREIGN KEY (family_id, created_by_person_id)
    REFERENCES family_members (family_id, person_id)
    ON DELETE RESTRICT,
  CONSTRAINT digital_use_target_items_id_scope_key
    UNIQUE (id, case_id, family_id, target_code),
  CONSTRAINT digital_use_target_items_supersedes_scope_fk
    FOREIGN KEY (supersedes_id, case_id, family_id, target_code)
    REFERENCES digital_use_target_items (id, case_id, family_id, target_code)
    ON DELETE RESTRICT,
  CONSTRAINT digital_use_target_items_revision_key
    UNIQUE (case_id, target_code, revision),
  CONSTRAINT digital_use_target_items_revision_check CHECK (revision >= 1),
  CONSTRAINT digital_use_target_items_selection_revision_check
    CHECK (selection_revision >= 1),
  CONSTRAINT digital_use_target_items_package_check CHECK (
    length(scene_package_version) BETWEEN 1 AND 64
    AND scene_package_version = btrim(scene_package_version)
  ),
  CONSTRAINT digital_use_target_items_target_code_check CHECK (
    target_code IN (
      'SLEEP',
      'EXERCISE',
      'HOBBIES',
      'CHORES',
      'FAMILY_GATHERING',
      'OUTDOOR_ACTIVITY',
      'EMOTION_REGULATION_1',
      'TIME_MANAGEMENT',
      'FAMILY_RELATIONSHIP',
      'EMOTION_REGULATION_2'
    )
  ),
  CONSTRAINT digital_use_target_items_target_text_check CHECK (
    concrete_target_text IS NULL OR (
      concrete_target_text = btrim(concrete_target_text)
      AND length(concrete_target_text) BETWEEN 1 AND 2000
    )
  ),
  CONSTRAINT digital_use_target_items_payload_shape_check CHECK (
    (feasibility_payload IS NULL OR jsonb_typeof(feasibility_payload) = 'object')
    AND (progress_payload IS NULL OR jsonb_typeof(progress_payload) = 'object')
    AND jsonb_typeof(progress_evidence_refs) = 'array'
    AND jsonb_typeof(help_history_refs) = 'array'
    AND jsonb_typeof(source_refs) = 'array'
  ),
  CONSTRAINT digital_use_target_items_supersession_shape_check CHECK (
    (superseded_at IS NULL)
    OR (supersedes_id IS NOT NULL OR revision >= 1)
  )
);

CREATE UNIQUE INDEX digital_use_target_items_current_key
  ON digital_use_target_items (case_id, target_code)
  WHERE superseded_at IS NULL;

CREATE UNIQUE INDEX digital_use_target_items_supersedes_key
  ON digital_use_target_items (supersedes_id)
  WHERE supersedes_id IS NOT NULL;

CREATE INDEX digital_use_target_items_selection_idx
  ON digital_use_target_items (case_id, selection_revision, target_code);

CREATE INDEX digital_use_target_items_family_case_idx
  ON digital_use_target_items (family_id, case_id, target_code);

CREATE FUNCTION digital_use_target_items_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_anchor_package text;
  v_previous digital_use_target_items%ROWTYPE;
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
      RAISE EXCEPTION 'DIGITAL_USE_TARGET_REVISION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT * INTO v_previous
      FROM digital_use_target_items
     WHERE id = NEW.supersedes_id
     FOR UPDATE;

    IF NOT FOUND
       OR v_previous.family_id <> NEW.family_id
       OR v_previous.case_id <> NEW.case_id
       OR v_previous.scene_package_version <> NEW.scene_package_version
       OR v_previous.target_code <> NEW.target_code
       OR NEW.revision <> v_previous.revision + 1
       OR NEW.selection_revision < v_previous.selection_revision
       OR v_previous.superseded_at IS NULL
    THEN
      RAISE EXCEPTION 'DIGITAL_USE_TARGET_SUPERSESSION_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'DIGITAL_USE_TARGET_INSERT_MUST_BE_CURRENT' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER digital_use_target_items_insert_guard
  BEFORE INSERT ON digital_use_target_items
  FOR EACH ROW EXECUTE FUNCTION digital_use_target_items_insert_guard();

CREATE FUNCTION digital_use_target_items_update_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.scene_package_version IS DISTINCT FROM OLD.scene_package_version
     OR NEW.target_code IS DISTINCT FROM OLD.target_code
     OR NEW.selection_revision IS DISTINCT FROM OLD.selection_revision
     OR NEW.revision IS DISTINCT FROM OLD.revision
     OR NEW.selected IS DISTINCT FROM OLD.selected
     OR NEW.concrete_target_text IS DISTINCT FROM OLD.concrete_target_text
     OR NEW.feasibility_payload IS DISTINCT FROM OLD.feasibility_payload
     OR NEW.progress_payload IS DISTINCT FROM OLD.progress_payload
     OR NEW.progress_evidence_refs IS DISTINCT FROM OLD.progress_evidence_refs
     OR NEW.help_history_refs IS DISTINCT FROM OLD.help_history_refs
     OR NEW.source_refs IS DISTINCT FROM OLD.source_refs
     OR NEW.created_by_person_id IS DISTINCT FROM OLD.created_by_person_id
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'DIGITAL_USE_TARGET_SUBSTANTIVE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_USE_TARGET_SUPERSESSION_INVALID' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER digital_use_target_items_update_guard
  BEFORE UPDATE ON digital_use_target_items
  FOR EACH ROW EXECUTE FUNCTION digital_use_target_items_update_guard();

ALTER TABLE digital_use_target_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_use_target_items FORCE ROW LEVEL SECURITY;

CREATE POLICY digital_use_target_items_family_scope ON digital_use_target_items
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

GRANT SELECT, INSERT ON digital_use_target_items TO xiaoshuyin_app;
GRANT UPDATE (superseded_at) ON digital_use_target_items TO xiaoshuyin_app;

-- Slice 12 remains the artifact owner. Slice 13 only extends the bounded
-- vocabulary for the approved A3000 versioned self-assessment projection.
ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_type_check;
ALTER TABLE scene_artifacts
  ADD CONSTRAINT scene_artifacts_type_check CHECK (
    artifact_type IN (
      'SUPPLEMENTAL_ASSESSMENT_BOUNDARY',
      'TIMELINE',
      'SOLUTION_SUMMARY',
      'FAMILY_ALLIANCE_SELF_ASSESSMENT'
    )
  );

ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_source_node_check;
ALTER TABLE scene_artifacts
  ADD CONSTRAINT scene_artifacts_source_node_check CHECK (
    source_node_code IN ('01000', 'A2007', 'A2010', 'A3000')
  );

ALTER TABLE scene_artifacts DROP CONSTRAINT scene_artifacts_type_source_check;
ALTER TABLE scene_artifacts
  ADD CONSTRAINT scene_artifacts_type_source_check CHECK (
    (artifact_type = 'SUPPLEMENTAL_ASSESSMENT_BOUNDARY' AND source_node_code = '01000')
    OR (artifact_type = 'TIMELINE' AND source_node_code = 'A2007')
    OR (artifact_type = 'SOLUTION_SUMMARY' AND source_node_code = 'A2010')
    OR (artifact_type = 'FAMILY_ALLIANCE_SELF_ASSESSMENT' AND source_node_code = 'A3000')
  );
